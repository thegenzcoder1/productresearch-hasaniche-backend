#!/bin/bash

# Configuration
APP_DIR="/home/deploy/apps/productresearch-hasaniche-backend"
PM2_APP_NAME="product-research-backend"

echo "======================================"
echo "🚀 Starting Deployment Process..."
echo "======================================"

# Navigate to the app directory
echo "📂 Moving to $APP_DIR..."
cd $APP_DIR || { echo "❌ Error: Directory not found!"; exit 1; }

# ── DATA SAFETY: back up the SQLite DB + uploads BEFORE deploying ──────────
# data/ and uploads/ are git-ignored, so git pull / npm install never touch them,
# but we snapshot them first so any deploy is fully recoverable.
BACKUP_DIR="$APP_DIR/backups"
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR" "$APP_DIR/data" "$APP_DIR/uploads"

echo "🗃️  Backing up persistent data (pre-deploy snapshot $STAMP)..."
if [ -f "$APP_DIR/data/app.db" ]; then
  cp "$APP_DIR/data/app.db" "$BACKUP_DIR/app-$STAMP.db"
  echo "   ✔ data/app.db  -> backups/app-$STAMP.db"
else
  echo "   ℹ️  No data/app.db yet (first deploy?) — nothing to back up."
fi
if [ -n "$(ls -A "$APP_DIR/uploads" 2>/dev/null)" ]; then
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$APP_DIR" uploads
  echo "   ✔ uploads/     -> backups/uploads-$STAMP.tar.gz"
fi
# Keep only the 10 most recent backups of each kind
ls -1t "$BACKUP_DIR"/app-*.db        2>/dev/null | tail -n +11 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/uploads-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm -f

# Pull the latest code
echo "⬇️  Pulling latest code from GitHub (origin/main)..."
git pull origin main || { echo "❌ Error: Git pull failed!"; exit 1; }

# Install dependencies just in case the package.json changed
# (data/ and uploads/ are git-ignored, so the SQLite DB & images are untouched)
echo "📦 Installing npm dependencies..."
npm install || { echo "❌ Error: npm install failed!"; exit 1; }

# ── Load the LATEST .env and hand it to PM2 on every deploy ────────────────
# The app also reads .env via dotenv at startup, but PM2 caches the environment
# from the first `pm2 start`, and dotenv won't override an already-set variable.
# So we export the current .env into the shell and restart with --update-env,
# guaranteeing your freshly-edited .env values are applied every single deploy.
echo "🔑 Loading environment from .env..."
if [ -f "$APP_DIR/.env" ]; then
  set -a                 # auto-export everything we source
  . "$APP_DIR/.env"      # load the current .env into this shell
  set +a
  echo "   ✔ .env loaded into deploy environment"
else
  echo "   ⚠️  Warning: .env not found — the app will fall back to defaults!"
fi

# Restart with --update-env so PM2 replaces its cached env with the fresh one
echo "🔄 Restarting API in PM2 (with fresh .env)..."
pm2 restart $PM2_APP_NAME --update-env || pm2 start server.js --name $PM2_APP_NAME --update-env

# Wait a second for it to boot
sleep 2

# Confirm the persistent data is still in place after the deploy
echo "🔎 Verifying data retention..."
if [ -f "$APP_DIR/data/app.db" ]; then
  echo "   ✔ data/app.db present ($(du -h "$APP_DIR/data/app.db" | cut -f1)), $(ls -1 "$APP_DIR/uploads" 2>/dev/null | wc -l) file(s) in uploads/"
else
  echo "   ℹ️  data/app.db not found yet — it will be created on first boot."
fi

# Log the contents of the .env file
echo "📄 Checking .env configuration..."
echo "--------------------------------------"
cat .env || echo "⚠️ Warning: .env file not found or unreadable!"
echo "--------------------------------------"

# Show the live logs
echo "📜 Tailing live logs... (Press CTRL+C to exit logs)"
echo "--------------------------------------"
pm2 logs $PM2_APP_NAME --lines 20
