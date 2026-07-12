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

# ── Load .env FIRST so we know where the persistent data actually lives ────
echo "🔑 Loading environment from .env..."
if [ -f "$APP_DIR/.env" ]; then
  set -a                 # auto-export everything we source
  . "$APP_DIR/.env"      # load the current .env into this shell
  set +a
  echo "   ✔ .env loaded"
else
  echo "   ⚠️  Warning: .env not found — using defaults (data will live INSIDE the repo!)."
  echo "      Create .env with DATA_DIR / UPLOAD_DIR before running the app in production."
fi

# Resolve persistent paths (fall back to in-repo defaults if not set in .env)
DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
UPLOAD_DIR="${UPLOAD_DIR:-$APP_DIR/uploads}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$DATA_DIR")/backups}"   # sits next to DATA_DIR (outside the repo when DATA_DIR is external)
mkdir -p "$DATA_DIR" "$UPLOAD_DIR" "$BACKUP_DIR"
echo "   📁 DATA_DIR=$DATA_DIR"
echo "   📁 UPLOAD_DIR=$UPLOAD_DIR"
echo "   📁 BACKUP_DIR=$BACKUP_DIR"

# ── DATA SAFETY: back up the SQLite DB + uploads BEFORE deploying ──────────
STAMP=$(date +%Y%m%d-%H%M%S)
echo "🗃️  Backing up persistent data (pre-deploy snapshot $STAMP)..."
if [ -f "$DATA_DIR/app.db" ]; then
  cp "$DATA_DIR/app.db" "$BACKUP_DIR/app-$STAMP.db"
  echo "   ✔ app.db  -> $BACKUP_DIR/app-$STAMP.db"
else
  echo "   ℹ️  No app.db yet (first deploy?) — nothing to back up."
fi
if [ -n "$(ls -A "$UPLOAD_DIR" 2>/dev/null)" ]; then
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
  echo "   ✔ uploads -> $BACKUP_DIR/uploads-$STAMP.tar.gz"
fi
# Keep only the 10 most recent backups of each kind
ls -1t "$BACKUP_DIR"/app-*.db         2>/dev/null | tail -n +11 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/uploads-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm -f

# Pull the latest code
echo "⬇️  Pulling latest code from GitHub (origin/main)..."
git pull origin main || { echo "❌ Error: Git pull failed!"; exit 1; }

# Install dependencies just in case the package.json changed
echo "📦 Installing npm dependencies..."
npm install || { echo "❌ Error: npm install failed!"; exit 1; }

# Restart with --update-env so PM2 applies the fresh .env every deploy
echo "🔄 Restarting API in PM2 (with fresh .env)..."
pm2 restart $PM2_APP_NAME --update-env || pm2 start server.js --name $PM2_APP_NAME --update-env

# Wait a second for it to boot
sleep 2

# Confirm the persistent data is still in place after the deploy
echo "🔎 Verifying data retention..."
if [ -f "$DATA_DIR/app.db" ]; then
  echo "   ✔ app.db present ($(du -h "$DATA_DIR/app.db" | cut -f1)), $(ls -1 "$UPLOAD_DIR" 2>/dev/null | wc -l) file(s) in uploads/"
else
  echo "   ℹ️  app.db not found yet — it will be created on first boot."
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
