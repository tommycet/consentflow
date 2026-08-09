#!/bin/bash
# run-all-tests.sh — Run all ConsentFlow tests (Solidity + Backend) in one command
set -e

echo "╔══════════════════════════════════════════╗"
echo "║   ConsentFlow Full Test Suite            ║"
echo "╚══════════════════════════════════════════╝"
echo ""

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Solidity Tests ──────────────────────────────────
echo "━━━ Solidity Foundry Tests ━━━"
export PATH="$HOME/.foundry/bin:$PATH"
forge test --force 2>&1 | tail -15
echo ""

# ── Backend Integration Tests ───────────────────────
echo "━━━ Backend Integration Tests ━━━"
cd backend
fuser -k 4001/tcp 2>/dev/null || true
sleep 1
node test/api.test.js 2>&1
echo ""

# ── Summary ────────────────────────────────────────
echo "╔══════════════════════════════════════════╗"
echo "║  All tests complete.                      ║"
echo "╚══════════════════════════════════════════╝"
