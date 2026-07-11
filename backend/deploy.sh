#!/bin/bash
set -e

echo "==> Pulling latest code..."
git pull

echo "==> Installing dependencies (prisma generate runs automatically)..."
npm install

echo "==> Running database migrations..."
npx prisma migrate deploy

echo "==> Restarting app..."
pm2 restart nimbasia-backend || pm2 start src/server.js --name nimbasia-backend

echo "==> Deploy complete."
