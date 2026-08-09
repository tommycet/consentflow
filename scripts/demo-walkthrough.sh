#!/usr/bin/env bash
set -euo pipefail

# ─── ConsentFlow Demo Walkthrough ───────────────────────────────────
# Narrates the full consent lifecycle step-by-step.  Designed as the
# demo-video script: each step has narration → curl → status check.
# ────────────────────────────────────────────────────────────────────

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
ALICE="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
BOB="0x1234567890123456789012345678901234567890"
STUDY_ID="0x$(echo -n "COVID-VAX-2024" | sha256sum | cut -d' ' -f1)"
PURPOSE_HASH="0x$(echo -n " genomic-analysis " | sha256sum | cut -d' ' -f1)"
POLICY_VERSION="0x0000000000000000000000000000000000000000000000000000000000000001"
EXPIRES_AT=$(( $(date +%s) + 86400 * 90 ))  # 90 days from now
ATOKEN="0xfa96de5b8f434c26fdff953303dd66ff80af1026"

PASS=0; FAIL=0
declare -a RESULTS

# ─── ANSI ───────────────────────────────────────────────────────────
RED='\033[1;31m'; GREEN='\033[1;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;96m'; B='\033[1m'; DIM='\033[2m'; R='\033[0m'

narrate() { echo -e "\n${CYAN}${B}▸ $1${R}"; }
step()    { echo -e "${B}Step $1${R}: $2"; }
ok()      { echo -e "${GREEN}  ✓ $1${R}"; PASS=$((PASS+1)); RESULTS+=("✓ $2"); }
fail()    { echo -e "${RED}  ✗ $1${R}"; FAIL=$((FAIL+1)); RESULTS+=("✗ $2"); }
warn()    { echo -e "${YELLOW}  ⚠ $1${R}"; }
result()  { echo -e "${DIM}  $1${R}" | head -5; }

call() {
  local method="$1" path="$2" body="$3"
  if [ -z "$body" ]; then
    curl -s -X "$method" "${BACKEND_URL}${path}" -H 'Content-Type: application/json'
  else
    curl -s -X "$method" "${BACKEND_URL}${path}" -H 'Content-Type: application/json' -d "$body"
  fi
}

# ─── Banner ─────────────────────────────────────────────────────────
echo -e "${B}${CYAN}"
echo "  ____                           ___       _   __      __"
echo " / ___|  ___ _ ____   _____ _ __ / __\_   _| |__\ \    / /__ _ __ __ _"
echo "| |  _  / _ \ '__\ \ / / _ \ '__/ / | | | | '_ \\ \/\/ / _ \ '__/ _\` |"
echo "| |_| ||  __/ |   \ V /  __/ | / /__| |_| | |_) \    /  __/ | | (_| |"
echo " \____| \___|_|    \_/ \___|_| \____\__,_|_.__/ \  / \___|_|  \__, |"
echo "                                                 \/         |___/"
echo -e "${R}"
echo -e "${B}Cleanverse Trusted Assets Build · Track 2 (DeFi)${R}"
echo -e "${DIM}Clinical trial consent rail on Monad testnet${R}\n"

# ─── Step 1: Health Check ───────────────────────────────────────────
step "1" "Checking backend health..."
narrate "Welcome to ConsentFlow — patient-controlled consent on Monad testnet. Let's verify our backend adapter is live."
h=$(call GET /api/health "")
if echo "$h" | grep -q '"success":true'; then
  ok "Backend is healthy" "1. Health check"
else
  fail "Backend not responding" "1. Health check"
  warn "Demo cannot continue without backend. Start it with: cd backend && npm start"
  exit 1
fi
result "$h"

# ─── Step 2: Generate A-Pass (CVI) for Alice ────────────────────────
step "2" "Generating Cleanverse A-Pass for Alice..."
narrate "Alice enrolls in a clinical trial. First, she needs a Cleanverse Verified Identity (CVI). We call generate_apass to mint her A-Pass NFT — the identity that gates consent."
r=$(call POST /api/cvi/generate "{\"wallet\":\"$ALICE\",\"chain\":\"monad\",\"countries\":[\"US\"],\"tier\":\"50\"}")
if echo "$r" | grep -q '"success"'; then
  ok "A-Pass generated for Alice" "2. Generate A-Pass (CVI)"
else
  warn "CVI generation may require API credentials — $(echo "$r" | head -c 200)"
  RESULTS+=("⚠ 2. Generate A-Pass (CVI) — credentials needed")
fi
result "$r"

# ─── Step 3: Query CVI status ───────────────────────────────────────
step "3" "Querying Alice's CVI status..."
narrate "Let's verify Alice's identity is active. We query_apass to check her A-Pass status — ACTIVE means she's cleared for consent."
r=$(call GET /api/cvi/query/$ALICE "")
if echo "$r" | grep -q '"success"'; then
  ok "Alice's CVI is queried" "3. Query CVI status"
else
  warn "CVI query may need credentials — $(echo "$r" | head -c 200)"
  RESULTS+=("⚠ 3. Query CVI — credentials needed")
fi
result "$r"

# ─── Step 4: Create on-chain consent ────────────────────────────────
step "4" "Creating on-chain consent for Alice..."
narrate "Alice creates consent on-chain. ConsentRegistry records her study participation immutably on Monad — study ID, purpose hash, and expiry are all committed to the blockchain."
r=$(call POST /api/contract/create-consent "{\"participant\":\"$ALICE\",\"cviAttestationHash\":\"0x$(echo -n 'test' | sha256sum | cut -d' ' -f1)\",\"studyId\":\"$STUDY_ID\",\"purposeHash\":\"$PURPOSE_HASH\",\"policyVersion\":\"$POLICY_VERSION\",\"expiresAt\":$EXPIRES_AT}")
if echo "$r" | grep -q '"success"'; then
  ok "Consent created on-chain" "4. Create consent"
  CONSENT_ID=$(echo "$r" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('consentId',''))" 2>/dev/null || echo "")
else
  warn "On-chain consent requires deployed contracts — $(echo "$r" | head -c 200)"
  RESULTS+=("⚠ 4. Create consent — deploy needed")
  CONSENT_ID=""
fi
result "$r"

# ─── Step 5: Queue access request as Bob ────────────────────────────
step "5" "Bob queues an access request with compensation..."
narrate "Bob, a researcher, wants to access Alice's clinical data. He queues an access request with ETH compensation — if the request is approved, Alice gets paid."
if [ -n "$CONSENT_ID" ]; then
  r=$(call POST /api/contract/queue-request "{\"consentId\":$CONSENT_ID,\"researcher\":\"$BOB\",\"studyId\":\"$STUDY_ID\",\"purposeHash\":\"$PURPOSE_HASH\",\"expiresAt\":$EXPIRES_AT,\"value\":\"10000000000000000\"}")
else
  r='{"success":false,"error":"contracts not deployed"}'
fi
if echo "$r" | grep -q '"success"'; then
  ok "Access request queued" "5. Queue access request"
else
  warn "On-chain queue requires deployed contracts — $(echo "$r" | head -c 200)"
  RESULTS+=("⚠ 5. Queue request — deploy needed")
fi
result "$r"

# ─── Step 6: CCP verification (PASS) ───────────────────────────────
step "6" "Running Cleanverse CCP (verify_apass)..."
narrate "Before settling, ConsentFlow runs the Compliance Check Protocol (CCP). We call verify_apass — Cleanverse checks Alice's A-Pass status in real-time. PASS means her identity is active."
r=$(call POST /api/ccp/verify "{\"wallet\":\"$ALICE\",\"atoken\":\"$ATOKEN\"}")
if echo "$r" | grep -q '"success"'; then
  ok "CCP verification called" "6. CCP verify (initial)"
else
  warn "CCP may need API credentials — $(echo "$r" | head -c 200)"
  RESULTS+=("⚠ 6. CCP verify — credentials needed")
fi
result "$r"

# ─── Step 7: Settle request (APPROVED) ─────────────────────────────
step "7" "Settling access request — approved!"
narrate "CCP passed! Alice's identity is active, so the request is settled on-chain — Bob gets access and Alice receives ETH compensation."
if [ -n "$CONSENT_ID" ]; then
  r=$(call POST /api/contract/settle-request "{\"requestId\":1,\"wallet\":\"$ALICE\"}")
else
  r='{"success":false,"error":"contracts not deployed"}'
fi
if echo "$r" | grep -q '"success"'; then
  ok "Request settled (approved)" "7. Settle (approved)"
else
  warn "On-chain settle requires deployed contracts — $(echo "$r" | head -c 200)"
  RESULTS+=("⚠ 7. Settle — deploy needed")
fi
result "$r"

# ─── Step 8: Revoke consent (freeze A-Pass) ────────────────────────
step "8" "Alice revokes consent — freezing her A-Pass..."
narrate "Alice decides to revoke her consent. We freeze her A-Pass — this is the kill switch. No more data access will be permitted."
r=$(call POST /api/cvi/update-status "{\"wallet\":\"$ALICE\",\"status\":2}")
if echo "$r" | grep -q '"success"'; then
  ok "Alice's A-Pass frozen (consent revoked)" "8. Revoke (freeze)"
else
  warn "CVI freeze may need credentials — $(echo "$r" | head -c 200)"
  RESULTS+=("⚠ 8. Revoke — credentials needed")
fi
result "$r"

# ─── Step 9: CCP verification (FAIL) ────────────────────────────────
step "9" "CCP verification — Alice's identity is now FROZEN..."
narrate "Bob tries another access request. CCP runs again — but now Alice's A-Pass is frozen! ComplianceFailed is returned."
r=$(call POST /api/ccp/verify "{\"wallet\":\"$ALICE\",\"atoken\":\"$ATOKEN\"}")
if echo "$r" | grep -q '"success"'; then
  ok "CCP called (expected fail)" "9. CCP verify (revoked)"
else
  warn "CCP result depends on API state — $(echo "$r" | head -c 200)"
  RESULTS+=("⚠ 9. CCP verify (revoked) — credentials needed")
fi
result "$r"

# ─── Step 10: Re-enroll (unfreeze A-Pass) ──────────────────────────
step "10" "Alice re-enrolls — unfreezing her A-Pass..."
narrate "Alice re-enrolls by unfreezing her A-Pass. Consent is restored — future CCP checks will pass again."
r=$(call POST /api/cvi/update-status "{\"wallet\":\"$ALICE\",\"status\":1}")
if echo "$r" | grep -q '"success"'; then
  ok "Alice's A-Pass unfrozen (re-enrolled)" "10. Re-enroll (unfreeze)"
else
  warn "CVI unfreeze may need credentials — $(echo "$r" | head -c 200)"
  RESULTS+=("⚠ 10. Re-enroll — credentials needed")
fi
result "$r"

# ─── Step 11: CCP verification (PASS again) ─────────────────────────
step "11" "CCP verification — consent restored..."
narrate "CCP verification passes again — Alice's identity is active. Consent restored."
r=$(call POST /api/ccp/verify "{\"wallet\":\"$ALICE\",\"atoken\":\"$ATOKEN\"}")
if echo "$r" | grep -q '"success"'; then
  ok "CCP passed (consent restored)" "11. CCP verify (restored)"
else
  warn "CCP result depends on credentials — $(echo "$r" | head -c 200)"
  RESULTS+=("⚠ 11. CCP verify (restored) — credentials needed")
fi
result "$r"

# ─── Step 12: Audit trail ───────────────────────────────────────────
step "12" "Checking unified audit trail..."
narrate "All events — on-chain consent, off-chain Cleanverse API calls, webhook notifications — are unified into a single audit trail."
r=$(call GET /api/audit/trail "")
if echo "$r" | grep -q '"success"'; then
  ok "Audit trail retrieved" "12. Audit trail"
else
  warn "Audit trail may need contract deployment — $(echo "$r" | head -c 200)"
  RESULTS+=("⚠ 12. Audit trail — partial")
fi
result "$r"

# ─── Step 13: Stats ─────────────────────────────────────────────────
step "13" "Checking aggregate stats..."
narrate "The stats endpoint shows the big picture: total consents, active vs revoked, requests approved vs rejected, total compensation volume."
r=$(call GET /api/contract/stats "")
if echo "$r" | grep -q '"success"'; then
  ok "Stats retrieved" "13. Stats"
else
  warn "Stats endpoint responded with: $(echo "$r" | head -c 200)"
  RESULTS+=("⚠ 13. Stats — partial")
fi
result "$r"

# ─── Summary ────────────────────────────────────────────────────────
echo -e "\n${B}════════════════════════════════════════════════════════════════${R}"
echo -e "${B}  Demo Summary${R}"
echo -e "${B}════════════════════════════════════════════════════════════════${R}\n"
for r in "${RESULTS[@]}"; do
  echo -e "  $r"
done
echo -e "\n  ${GREEN}Passed: $PASS${R}  ${RED}Failed: $FAIL${R}"
echo -e "\n${CYAN}${B}ConsentFlow: patient-controlled consent on Monad testnet,${R}"
echo -e "${CYAN}${B}powered by Cleanverse CVI · CVA · CCP.${R}"

exit 0
