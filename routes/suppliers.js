const router = require('express').Router();
const db = require('../db');

router.post('/products/:id/suppliers', (req, res) => {
  const { name, phone } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const info = db.prepare(`INSERT INTO suppliers (product_id, name, phone) VALUES (?, ?, ?)`)
    .run(req.params.id, name, phone ?? null);
  res.status(201).json({ id: info.lastInsertRowid, product_id: Number(req.params.id), name, phone: phone ?? null });
});

router.patch('/suppliers/:sid', (req, res) => {
  const fields = ['name', 'phone'].filter((k) => k in (req.body || {}));
  if (!fields.length) return res.status(400).json({ error: 'No fields' });
  const set = fields.map((f) => `${f}=@${f}`).join(', ');
  db.prepare(`UPDATE suppliers SET ${set} WHERE id=@id`).run({ ...req.body, id: req.params.sid });
  res.json({ ok: true });
});

router.delete('/suppliers/:sid', (req, res) => {
  db.prepare(`DELETE FROM suppliers WHERE id=?`).run(req.params.sid);
  res.json({ ok: true });
});

module.exports = router;
