// 7-day purge of archived products (cascades remove children)
const db = require('../db');

function purge() {
  const info = db.prepare(
    `DELETE FROM products WHERE status='archived'
     AND archived_at < datetime('now','-7 days')`
  ).run();
  if (info.changes) console.log(`[cleanup] purged ${info.changes} product(s)`);
}

module.exports = () => { purge(); setInterval(purge, 60 * 60 * 1000); }; // hourly
