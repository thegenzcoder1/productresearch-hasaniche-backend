const router = require('express').Router();
const db = require('../db');

// Move up / down — swap with neighbour
router.patch('/:id/move', (req, res) => {
  const dir = req.body.direction; // 'up' | 'down'
  const cur = db.prepare(`SELECT rank_position FROM products WHERE id=? AND status='active'`).get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  const targetPos = dir === 'up' ? cur.rank_position - 1 : cur.rank_position + 1;
  const neighbour = db.prepare(`SELECT id FROM products WHERE status='active' AND rank_position=?`).get(targetPos);
  if (!neighbour) return res.json({ ok: true }); // already top/bottom
  const swap = db.transaction(() => {
    db.prepare(`UPDATE products SET rank_position=? WHERE id=?`).run(targetPos, req.params.id);
    db.prepare(`UPDATE products SET rank_position=? WHERE id=?`).run(cur.rank_position, neighbour.id);
  });
  swap();
  res.json({ ok: true });
});

// Bulk drag-reorder — full ordered id array
router.put('/reorder', (req, res) => {
  const ids = req.body.orderedIds;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'orderedIds required' });
  const stmt = db.prepare(`UPDATE products SET rank_position=? WHERE id=? AND status='active'`);
  const run = db.transaction((arr) => arr.forEach((id, i) => stmt.run(i + 1, id)));
  run(ids);
  res.json({ ok: true });
});

module.exports = router;
