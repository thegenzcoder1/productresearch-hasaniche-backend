// Gap open/close helpers for archive & restore (transactional)
const db = require('../db');

const archive = db.transaction((id) => {
  const p = db.prepare(`SELECT rank_position FROM products WHERE id=? AND status='active'`).get(id);
  if (!p) throw new Error('Not active');
  db.prepare(`UPDATE products
              SET status='archived', archived_at=datetime('now'),
                  saved_rank_position=rank_position, rank_position=NULL,
                  updated_at=datetime('now')
              WHERE id=?`).run(id);
  db.prepare(`UPDATE products SET rank_position = rank_position - 1
              WHERE status='active' AND rank_position > ?`).run(p.rank_position);
});

const restore = db.transaction((id) => {
  const p = db.prepare(`SELECT saved_rank_position FROM products WHERE id=? AND status='archived'`).get(id);
  if (!p) throw new Error('Not archived');
  const count = db.prepare(`SELECT COUNT(*) n FROM products WHERE status='active'`).get().n;
  const target = Math.min(Math.max(p.saved_rank_position || count + 1, 1), count + 1);
  db.prepare(`UPDATE products SET rank_position = rank_position + 1
              WHERE status='active' AND rank_position >= ?`).run(target);
  db.prepare(`UPDATE products
              SET status='active', archived_at=NULL,
                  rank_position=?, saved_rank_position=NULL,
                  updated_at=datetime('now')
              WHERE id=?`).run(target, id);
});

module.exports = { archive, restore };
