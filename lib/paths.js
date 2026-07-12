// Resolves where persistent data lives.
//
// By default the SQLite DB and uploads live inside the app folder (./data, ./uploads)
// — fine for local dev. IN PRODUCTION set DATA_DIR and UPLOAD_DIR in .env to a location
// OUTSIDE the repo (e.g. /home/deploy/pr-persistent/*) so deleting or re-cloning the
// repo can never delete your data.
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT, 'data');

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(ROOT, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

module.exports = { DATA_DIR, UPLOAD_DIR };
