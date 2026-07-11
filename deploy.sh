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

# Pull the latest code
echo "⬇️  Pulling latest code from GitHub (origin/main)..."
git pull origin main || { echo "❌ Error: Git pull failed!"; exit 1; }

# Install dependencies just in case the package.json changed
# (data/ and uploads/ are git-ignored, so the SQLite DB & images are untouched)
echo "📦 Installing npm dependencies..."
npm install || { echo "❌ Error: npm install failed!"; exit 1; }

# Restart the PM2 process (using restart instead of start ensures it reloads gracefully if already running)
echo "🔄 Restarting API in PM2..."
pm2 restart $PM2_APP_NAME || pm2 start server.js --name $PM2_APP_NAME

# Wait a second for it to boot
sleep 2

# Log the contents of the .env file
echo "📄 Checking .env configuration..."
echo "--------------------------------------"
cat .env || echo "⚠️ Warning: .env file not found or unreadable!"
echo "--------------------------------------"

# Show the live logs
echo "📜 Tailing live logs... (Press CTRL+C to exit logs)"
echo "--------------------------------------"
pm2 logs $PM2_APP_NAME --lines 20
