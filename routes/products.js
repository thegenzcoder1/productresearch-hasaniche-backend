const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { archive, restore } = require('../lib/ranking');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_r, file, cb) =>
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => cb(null, /image\/(jpe?g|png|webp|gif)/.test(f.mimetype)),
});

const pendingCount = `(SELECT COUNT(*) FROM ad_links a
   WHERE a.product_id = p.id AND a.status = 'pending')`;
// Total impressions = sum of every ad-link's impression for the product
const totalImpressions = `(SELECT COALESCE(SUM(a.impression), 0) FROM ad_links a
   WHERE a.product_id = p.id)`;

// List active products (rank order) with pending_ads + total_impressions + tags + ad_angles
router.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*, ${pendingCount} AS pending_ads, ${totalImpressions} AS total_impressions
    FROM products p
    WHERE p.status='active'
    ORDER BY p.rank_position ASC
  `).all();
  const tagStmt = db.prepare(`SELECT tag FROM tags WHERE product_id=?`);
  const angleStmt = db.prepare(`SELECT angle FROM ad_angles WHERE product_id=? ORDER BY id`);
  for (const r of rows) {
    r.tags = tagStmt.all(r.id).map((t) => t.tag);
    r.ad_angles = angleStmt.all(r.id).map((a) => a.angle);
  }
  res.json(rows);
});

// Archived products with days_left before purge
router.get('/archived', (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*, ${pendingCount} AS pending_ads,
      CAST(7 - (julianday('now') - julianday(archived_at)) AS INTEGER) AS days_left
    FROM products p
    WHERE p.status='archived'
    ORDER BY p.archived_at DESC
  `).all();
  res.json(rows);
});

// One product with all sub-sections
router.get('/:id', (req, res) => {
  const id = req.params.id;
  const p = db.prepare(`SELECT p.*, ${pendingCount} AS pending_ads, ${totalImpressions} AS total_impressions FROM products p WHERE p.id=?`).get(id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.suppliers = db.prepare(`SELECT * FROM suppliers WHERE product_id=? ORDER BY id`).all(id);
  p.tags = db.prepare(`SELECT * FROM tags WHERE product_id=? ORDER BY id`).all(id);
  p.ad_links = db.prepare(`SELECT * FROM ad_links WHERE product_id=? ORDER BY id`).all(id);
  p.ad_angles = db.prepare(`SELECT * FROM ad_angles WHERE product_id=? ORDER BY id`).all(id);
  p.comments = db.prepare(`SELECT * FROM comments WHERE product_id=? ORDER BY created_at DESC, id DESC`).all(id);
  res.json(p);
});

// Create (append to ranking)
router.post('/', (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
  const next = db.prepare(
    `SELECT COALESCE(MAX(rank_position),0)+1 AS n FROM products WHERE status='active'`
  ).get().n;
  const info = db.prepare(
    `INSERT INTO products (name, description, status, rank_position)
     VALUES (?, ?, 'active', ?)`
  ).run(name.trim(), description ?? null, next);
  res.status(201).json({ id: info.lastInsertRowid });
});

// Partial update (per-section save)
router.patch('/:id', (req, res) => {
  const allowed = ['name', 'description', 'pain_point',
                   'amazon_sold_last_month', 'ig_impressions_6m',
                   'sourcing_cost', 'mrp', 'amazon_rating'];
  const fields = Object.keys(req.body || {}).filter((k) => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No valid fields' });
  const set = fields.map((f) => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE products SET ${set}, updated_at = datetime('now') WHERE id = @id`)
    .run({ ...req.body, id: req.params.id });
  res.json({ ok: true });
});

// Atomic bulk save — the whole product + its child collections in one call.
// Only fields/collections that are PRESENT in the body are touched (so e.g.
// ad_angles managed on the ranking page are left alone when omitted here).
router.put('/:id/full', (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const exists = db.prepare(`SELECT id FROM products WHERE id=?`).get(id);
  if (!exists) return res.status(404).json({ error: 'Not found' });
  if ('name' in b && (!b.name || !String(b.name).trim())) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const scalarAllowed = ['name', 'description', 'pain_point',
                         'amazon_sold_last_month', 'ig_impressions_6m',
                         'sourcing_cost', 'mrp', 'amazon_rating'];

  const save = db.transaction(() => {
    // product scalar fields (only those provided)
    const fields = Object.keys(b).filter((k) => scalarAllowed.includes(k));
    if (fields.length) {
      const set = fields.map((f) => `${f} = @${f}`).join(', ');
      db.prepare(`UPDATE products SET ${set}, updated_at = datetime('now') WHERE id = @id`)
        .run({ ...b, id });
    }

    // child collections — replace-all, but ONLY when the array is provided
    if (Array.isArray(b.suppliers)) {
      db.prepare(`DELETE FROM suppliers WHERE product_id=?`).run(id);
      const ins = db.prepare(`INSERT INTO suppliers (product_id, name, phone) VALUES (?, ?, ?)`);
      for (const s of b.suppliers) if (s && String(s.name || '').trim())
        ins.run(id, String(s.name).trim(), s.phone ? String(s.phone).trim() : null);
    }
    if (Array.isArray(b.tags)) {
      db.prepare(`DELETE FROM tags WHERE product_id=?`).run(id);
      const ins = db.prepare(`INSERT INTO tags (product_id, tag) VALUES (?, ?)`);
      for (const t of b.tags) { const v = (typeof t === 'string' ? t : t?.tag || '').trim(); if (v) ins.run(id, v); }
    }
    if (Array.isArray(b.ad_links)) {
      db.prepare(`DELETE FROM ad_links WHERE product_id=?`).run(id);
      const ins = db.prepare(`INSERT INTO ad_links (product_id, url, label, impression, status, created_at)
                              VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`);
      for (const l of b.ad_links) if (l && String(l.url || '').trim())
        ins.run(id, String(l.url).trim(), l.label ? String(l.label) : null,
                l.impression == null || l.impression === '' ? null : Number(l.impression),
                l.status === 'done' ? 'done' : 'pending', l.created_at || null);
    }
    if (Array.isArray(b.ad_angles)) {
      db.prepare(`DELETE FROM ad_angles WHERE product_id=?`).run(id);
      const ins = db.prepare(`INSERT INTO ad_angles (product_id, angle) VALUES (?, ?)`);
      for (const a of b.ad_angles) { const v = (typeof a === 'string' ? a : a?.angle || '').trim(); if (v) ins.run(id, v); }
    }
    if (Array.isArray(b.comments)) {
      db.prepare(`DELETE FROM comments WHERE product_id=?`).run(id);
      const ins = db.prepare(`INSERT INTO comments (product_id, body, created_at)
                              VALUES (?, ?, COALESCE(?, datetime('now')))`);
      for (const c of b.comments) if (c && String(c.body || '').trim())
        ins.run(id, String(c.body).trim(), c.created_at || null);
    }
  });

  try { save(); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Archive (soft delete)
router.delete('/:id', (req, res) => {
  try { archive(Number(req.params.id)); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Restore
router.post('/:id/restore', (req, res) => {
  try { restore(Number(req.params.id)); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Permanent hard delete
router.delete('/:id/permanent', (req, res) => {
  const p = db.prepare(`SELECT image_path FROM products WHERE id=?`).get(req.params.id);
  db.prepare(`DELETE FROM products WHERE id=?`).run(req.params.id);
  if (p && p.image_path) {
    const f = path.join(UPLOAD_DIR, path.basename(p.image_path));
    fs.existsSync(f) && fs.unlink(f, () => {});
  }
  res.json({ ok: true });
});

// Image upload / replace
router.post('/:id/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image (jpg/png/webp/gif, <=10MB)' });
  const rel = `/uploads/${req.file.filename}`;
  db.prepare(`UPDATE products SET image_path=?, updated_at=datetime('now') WHERE id=?`)
    .run(rel, req.params.id);
  res.json({ image_path: rel });
});

module.exports = router;
