const router = require('express').Router();
const db = require('../db');

router.post('/products/:id/ad-links', (req, res) => {
  const { url, label } = req.body || {};
  if (!url || !url.trim()) return res.status(400).json({ error: 'URL required' });
  const info = db.prepare(
    `INSERT INTO ad_links (product_id, url, label, status) VALUES (?, ?, ?, 'pending')`
  ).run(req.params.id, url.trim(), label ?? null);
  const row = db.prepare(`SELECT * FROM ad_links WHERE id=?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.patch('/ad-links/:id', (req, res) => {
  const fields = ['url', 'label', 'status'].filter((k) => k in (req.body || {}));
  if (!fields.length) return res.status(400).json({ error: 'No fields' });
  const set = fields.map((f) => `${f}=@${f}`).join(', ');
  db.prepare(`UPDATE ad_links SET ${set} WHERE id=@id`).run({ ...req.body, id: req.params.id });
  res.json({ ok: true });
});

router.delete('/ad-links/:id', (req, res) => {
  db.prepare(`DELETE FROM ad_links WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
