#!/usr/bin/env bash
set -euo pipefail

echo "=== ConsentFlow Deploy ==="

# ── Check for required env vars ──────────────────────────────────────────
if [[ -z "${DEPLOYER_PRIVATE_KEY:-}" || -z "${MONAD_RPC_URL:-}" ]]; then
  echo "⚠ No deployer key — skipping deploy. Set DEPLOYER_PRIVATE_KEY and re-run."
  exit 0
fi

# ── Run deployment ────────────────────────────────────────────────────────
echo "→ Deploying to chain (RPC: ${MONAD_RPC_URL})..."
forge script script/Deploy.s.sol --rpc-url "$MONAD_RPC_URL" --broadcast -y

# ── Extract deployed addresses from broadcast output ──────────────────────
BROADCAST_DIR=$(ls -d broadcast/DeployScript.s.sol/* 2>/dev/null | sort | tail -n 1)
if [[ -z "$BROADCAST_DIR" || ! -d "$BROADCAST_DIR" ]]; then
  echo "⚠ Could not find broadcast directory for addresses."
  exit 1
fi

RUN_LATEST=$(ls -d "$BROADCAST_DIR"/run-* 2>/dev/null | sort | tail -n 1)
if [[ -z "$RUN_LATEST" || ! -d "$RUN_LATEST" ]]; then
  echo "⚠ Could not find broadcast run directory for addresses."
  exit 1
fi

CS=$(cat "$RUN_LATEST"/call.json | grep -o '"ContributionReceipt deployed at: [^"]*' | grep -o '0x[a-fA-F0-9]\{40\}' | head -n 1 || true)
CR=$(cat "$RUN_LATEST"/call.json | grep -o '"ConsentRegistry deployed at: [^"]*' | grep -o '0x[a-fA-F0-9]\{40\}' | head -n 1 || true)

if [[ -z "$CS" || -z "$CR" ]]; then
  echo "⚠ Could not extract deployed addresses from broadcast output."
  exit 1
fi

echo "→ ContributionReceipt: $CS"
echo "→ ConsentRegistry: $CR"

# ── Write to .env.deployed ────────────────────────────────────────────────
cat > .env.deployed <<EOF
CONSENT_REGISTRY_ADDRESS=$CR
CONTRIBUTION_RECEIPT_ADDRESS=$CS
EOF
echo "→ Written addresses to .env.deployed"

# ── Verify deployment ─────────────────────────────────────────────────────
echo "→ Running deployment verification..."
forge script script/VerifyDeployment.s.sol --rpc-url "$MONAD_RPC_URL"

echo "=== Deploy Complete ==="
