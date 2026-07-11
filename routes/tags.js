const router = require('express').Router();
const db = require('../db');

router.post('/products/:id/tags', (req, res) => {
  const { tag } = req.body || {};
  if (!tag || !tag.trim()) return res.status(400).json({ error: 'Tag required' });
  const info = db.prepare(`INSERT INTO tags (product_id, tag) VALUES (?, ?)`)
    .run(req.params.id, tag.trim());
  res.status(201).json({ id: info.lastInsertRowid, product_id: Number(req.params.id), tag: tag.trim() });
});

router.patch('/tags/:tid', (req, res) => {
  const { tag } = req.body || {};
  if (!tag) return res.status(400).json({ error: 'Tag required' });
  db.prepare(`UPDATE tags SET tag=? WHERE id=?`).run(tag, req.params.tid);
  res.json({ ok: true });
});

router.delete('/tags/:tid', (req, res) => {
  db.prepare(`DELETE FROM tags WHERE id=?`).run(req.params.tid);
  res.json({ ok: true });
});

module.exports = router;
