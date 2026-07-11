const router = require('express').Router();
const db = require('../db');

router.post('/products/:id/comments', (req, res) => {
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'Comment required' });
  const info = db.prepare(`INSERT INTO comments (product_id, body) VALUES (?, ?)`)
    .run(req.params.id, body.trim());
  const row = db.prepare(`SELECT * FROM comments WHERE id=?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.delete('/comments/:id', (req, res) => {
  db.prepare(`DELETE FROM comments WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
