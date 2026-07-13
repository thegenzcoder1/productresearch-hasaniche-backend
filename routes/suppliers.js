const router = require('express').Router();
const db = require('../db');

router.post('/products/:id/suppliers', (req, res) => {
  const { name, phone, price, dropshipping } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const info = db.prepare(`INSERT INTO suppliers (product_id, name, phone, price, dropshipping) VALUES (?, ?, ?, ?, ?)`)
    .run(req.params.id, name, phone ?? null, price == null || price === '' ? null : Number(price), dropshipping ? 1 : 0);
  res.status(201).json(db.prepare(`SELECT * FROM suppliers WHERE id=?`).get(info.lastInsertRowid));
});

router.patch('/suppliers/:sid', (req, res) => {
  const fields = ['name', 'phone', 'price', 'dropshipping'].filter((k) => k in (req.body || {}));
  if (!fields.length) return res.status(400).json({ error: 'No fields' });
  const set = fields.map((f) => `${f}=@${f}`).join(', ');
  const body = { ...req.body };
  if ('dropshipping' in body) body.dropshipping = body.dropshipping ? 1 : 0;
  if ('price' in body) body.price = body.price == null || body.price === '' ? null : Number(body.price);
  db.prepare(`UPDATE suppliers SET ${set} WHERE id=@id`).run({ ...body, id: req.params.sid });
  res.json({ ok: true });
});

router.delete('/suppliers/:sid', (req, res) => {
  db.prepare(`DELETE FROM suppliers WHERE id=?`).run(req.params.sid);
  res.json({ ok: true });
});

module.exports = router;
