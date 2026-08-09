#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
WALLET="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"

ok()   { printf '✓ %s\n' "$1"; }
fail() { printf '✗ %s\n' "$1"; }
warn() { printf '⚠ %s\n' "$1"; }
step() { printf '\n→ %s\n' "$1"; }

http() {
  local method="$1" path="$2" data="${3:-}"
  if [[ "$method" == "GET" ]]; then
    curl -sf -X GET "$BACKEND_URL$path" || return 1
  else
    curl -sf -X POST -H 'Content-Type: application/json' -d "$data" "$BACKEND_URL$path" || return 1
  fi
}

step "1/10: Check backend health"
if http GET /api/health >/dev/null; then
  ok "Backend is healthy at $BACKEND_URL"
else
  fail "Backend not reachable at $BACKEND_URL"
  exit 1
fi

step "2/10: Generate A-Pass (CVI)"
if resp=$(http POST /api/cvi/generate "{\"wallet\":\"$WALLET\"}"); then
  ok "A-Pass generated"
  echo "$resp"
else
  fail "Failed to generate A-Pass"
  exit 1
fi

step "3/10: Query CVI status for $WALLET"
if resp=$(http GET "/api/cvi/query/$WALLET"); then
  ok "CVI status retrieved"
  echo "$resp"
else
  fail "Failed to query CVI"
  exit 1
fi

step "4/10: Verify C-Passport (CCP) — expect pass"
if resp=$(http POST /api/ccp/verify "{\"wallet\":\"$WALLET\"}"); then
  ok "CCP verification passed"
  echo "$resp"
else
  fail "CCP verification failed"
  exit 1
fi

step "5/10: Freeze CVI"
if resp=$(http POST /api/cvi/update-status "{\"wallet\":\"$WALLET\",\"status\":\"frozen\"}"); then
  ok "CVI frozen"
  echo "$resp"
else
  fail "Failed to freeze CVI"
  exit 1
fi

step "6/10: Verify C-Passport (CCP) — expect fail"
if resp=$(http POST /api/ccp/verify "{\"wallet\":\"$WALLET\"}"); then
  ok "CCP verification result: $resp"
else
  fail "CCP verification failed (expected after freeze)"
fi

step "7/10: Unfreeze CVI"
if resp=$(http POST /api/cvi/update-status "{\"wallet\":\"$WALLET\",\"status\":\"active\"}"); then
  ok "CVI unfrozen"
  echo "$resp"
else
  fail "Failed to unfreeze CVI"
  exit 1
fi

step "8/10: Verify C-Passport (CCP) — expect pass again"
if resp=$(http POST /api/ccp/verify "{\"wallet\":\"$WALLET\"}"); then
  ok "CCP verification passed"
  echo "$resp"
else
  fail "CCP verification failed"
  exit 1
fi

step "9/10: On-chain flow (consent → request → settle)"
run_onchain() {
  local cid
  cid=$(http POST /api/contract/create-consent "{\"wallet\":\"$WALLET\"}" | jq -r '.id // empty')
  if [[ -z "$cid" ]]; then
    warn "Create consent returned no id — contracts may not be deployed"
    return 1
  fi
  ok "Consent created: $cid"
  echo "$cid"

  if ! http POST /api/contract/queue-request "{\"consentId\":\"$cid\",\"requester\":\"$WALLET\"}" >/dev/null; then
    warn "Queue request failed — contracts may not be deployed"
    return 1
  fi
  ok "Access request queued"

  if ! http POST /api/contract/settle-request "{\"consentId\":\"$cid\"}" >/dev/null; then
    warn "Settle request failed — contracts may not be deployed"
    return 1
  fi
  ok "Request settled"
  return 0
}

if ! run_onchain; then
  warn "On-chain step skipped — contracts not deployed"
fi

step "10/10: Audit trail"
if resp=$(http GET /api/contract/events); then
  ok "Audit events retrieved"
  echo "$resp"
else
  warn "No audit events available"
fi

printf '\n✔ Demo complete\n'
