const router = require('express').Router();
const db = require('../db');

router.post('/products/:id/ad-angles', (req, res) => {
  const { angle } = req.body || {};
  if (!angle || !angle.trim()) return res.status(400).json({ error: 'Angle required' });
  const info = db.prepare(`INSERT INTO ad_angles (product_id, angle) VALUES (?, ?)`)
    .run(req.params.id, angle.trim());
  res.status(201).json({ id: info.lastInsertRowid, product_id: Number(req.params.id), angle: angle.trim() });
});

router.patch('/ad-angles/:id', (req, res) => {
  const { angle } = req.body || {};
  if (!angle) return res.status(400).json({ error: 'Angle required' });
  db.prepare(`UPDATE ad_angles SET angle=? WHERE id=?`).run(angle, req.params.id);
  res.json({ ok: true });
});

router.delete('/ad-angles/:id', (req, res) => {
  db.prepare(`DELETE FROM ad_angles WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
