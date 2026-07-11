// SQLite connection + schema migration + admin seed
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  name                     TEXT NOT NULL,
  image_path               TEXT,
  description              TEXT,
  pain_point               TEXT,
  amazon_sold_last_month   INTEGER,
  ig_impressions_6m        INTEGER,
  sourcing_cost            REAL,
  mrp                      REAL,
  status                   TEXT NOT NULL DEFAULT 'active',
  rank_position            INTEGER,
  saved_rank_position      INTEGER,
  archived_at              TEXT,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ad_links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  label      TEXT,
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ad_angles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  angle      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_status_rank ON products(status, rank_position);
CREATE INDEX IF NOT EXISTS idx_adlinks_product      ON ad_links(product_id, status);
`);

// Lightweight migrations — add columns to pre-existing databases
const productCols = db.prepare(`PRAGMA table_info(products)`).all().map((c) => c.name);
if (!productCols.includes('sourcing_cost')) db.exec(`ALTER TABLE products ADD COLUMN sourcing_cost REAL`);
if (!productCols.includes('mrp')) db.exec(`ALTER TABLE products ADD COLUMN mrp REAL`);

// Seed admin user on boot
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUser);
if (!existing) {
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(adminUser, bcrypt.hashSync(adminPass, 12));
  console.log(`[db] seeded admin user "${adminUser}"`);
}

module.exports = db;
