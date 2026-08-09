#!/usr/bin/env bash
set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-4000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_CMD="${BACKEND_CMD:-cd backend && node index.js}"
FRONTEND_CMD="${FRONTEND_CMD:-cd frontend && npm run dev -- --port $FRONTEND_PORT}"

cleanup() {
  echo "\n→ Stopping services..."
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  echo "→ Services stopped"
}
trap cleanup EXIT

echo "→ Starting backend..."
eval "$BACKEND_CMD" &
BACKEND_PID=$!
echo "✓ Backend starting (PID $BACKEND_PID) — http://localhost:$BACKEND_PORT"

echo "→ Starting frontend..."
eval "$FRONTEND_CMD" &
FRONTEND_PID=$!
echo "✓ Frontend starting (PID $FRONTEND_PID) — http://localhost:$FRONTEND_PORT"

echo ""
echo "┌─────────────────────────────────────────┐"
echo "│  Backend  → http://localhost:$BACKEND_PORT      │"
echo "│  Frontend → http://localhost:$FRONTEND_PORT      │"
echo "└─────────────────────────────────────────┘"
echo ""
echo "Press Ctrl+C to stop both services"

wait
