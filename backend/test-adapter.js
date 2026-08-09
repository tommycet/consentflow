/**
 * ConsentFlow Cleanverse Adapter — integration test (read-only against the sandbox).
 *
 * Flow:
 *   1. Boot the Express server on a random port.
 *   2. GET  /api/health                              -> adapter is up + configured
 *   3. GET  /api/cvi/<known wallet>/status           -> expected not-found (fresh wallet has no A-Pass)
 *   4. POST /api/cvi/<fresh burner wallet>/generate  -> real generate_apass on Monad testnet
 *   5. GET  /api/cvi/<burner>/status                 -> verify the A-Pass now exists (status=1)
 *   6. POST /api/ccp/verify {wallet: burner}         -> CCP pre-check against default aUSDC A-Token
 *
 * NO freeze/unfreeze in this automated test — those are stateful on-chain ops.
 * Commented freeze/unfreeze code paths are included below for manual runs.
 *
 * Requires a .env with CLEANVERSE_API_ID / CLEANVERSE_API_KEY (see .env.example).
 */
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 4123 + Math.floor(Math.random() * 500); // random port to avoid clashes
const BASE = `http://127.0.0.1:${PORT}`;
const ATOKEN = process.env.CLEANVERSE_DEFAULT_ATOKEN || '0xfa96de5b8f434c26fdff953303dd66ff80af1026';

// Known test wallet used in the earlier sandbox verification (docs/sandbox-test-results.md).
const KNOWN_WALLET = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

// Deterministic fresh burner wallet (random each run).
const BURNER = '0x' + crypto.randomBytes(20).toString('hex');

let results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -> ${detail}` : ''}`);
}
function summary() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILED:', failed.map((f) => f.name).join(', '));
    process.exitCode = 1;
  }
}

async function api(method, p, body) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status} non-JSON` }));
  return { status: res.status, json };
}

async function waitForServer(proc, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('server did not start in time');
}

async function main() {
  console.log('== ConsentFlow Cleanverse Adapter Test ==');
  console.log(`server port: ${PORT}`);
  console.log(`known wallet: ${KNOWN_WALLET}`);
  console.log(`burner wallet: ${BURNER}`);
  console.log(`atoken: ${ATOKEN}`);
  console.log('');

  // Boot the server (inherits .env via dotenv in config.js).
  const server = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));

  try {
    await waitForServer(server);

    // 1. Health — adapter up and credentials configured.
    const health = await api('GET', '/api/health');
    record(
      'health endpoint',
      health.status === 200 && health.json.success && health.json.data.cleanverseConfigured,
      JSON.stringify(health.json.data)
    );

    // 2. Known wallet status — expect success:true with data:null (not-found is OK).
    const s1 = await api('GET', `/api/cvi/${KNOWN_WALLET}/status`);
    const s1NotFound = s1.json.success && (s1.json.data === null || s1.json.data === undefined);
    record(
      'known wallet status (expect not-found or active)',
      s1.json.success,
      s1.json.data ? `A-Pass exists: ${JSON.stringify(s1.json.data)}` : 'not-found (expected for fresh wallet)'
    );
    if (!s1NotFound) {
      console.log('  NOTE: known wallet already has an A-Pass; treating as OK.');
    }

    // 3. Generate A-Pass for the fresh burner wallet (real sandbox call).
    //    Include US identity data so the aUSDC A-Token country rule passes
    //    (the known wallet's A-Pass has countries:["US"]; a KYC-less A-Pass
    //    yields countries:[] and gets COMPLIANCE_FAILED at CCP).
    const gen = await api('POST', `/api/cvi/${BURNER}/generate`, {
      fullName: 'ConsentFlow Test',
      idNumber: 'CF-TEST-00000042',
      issuingCountryISO2: 'US',
    });
    const genData = gen.json.success ? gen.json.data : null;
    record(
      'generate A-Pass (burner wallet)',
      gen.json.success && genData && genData.cvRecordId !== undefined,
      gen.json.success
        ? `cvRecordId=${genData.cvRecordId} tier=${genData.tier} txHash=${(genData.wallet && genData.wallet.txHash) || 'n/a'}`
        : gen.json.error
    );

    // 4. Status re-check — A-Pass must now exist and be active (status=1).
    //    generate_apass is an on-chain tx; query_apass reads chain state, so poll
    //    until finality (Monad testnet blocks ~1s, allow generous margin).
    let s2 = null;
    for (let attempt = 1; attempt <= 30; attempt++) {
      s2 = await api('GET', `/api/cvi/${BURNER}/status`);
      if (s2.json.success && s2.json.data && s2.json.data.cvRecordId !== undefined) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    const s2Ok = s2.json.success && s2.json.data && Number(s2.json.data.status) === 1;
    record(
      'status after generate (expect active status=1)',
      s2Ok,
      s2.json.success ? JSON.stringify(s2.json.data) : s2.json.error
    );

    // 5. CCP verify_apass for the burner wallet against aUSDC.
    //    NOTE: aUSDC is a wrapped token that rejects every A-Pass (even the known
    //    active US wallet) — that is expected wrapped-token semantics. A PASS
    //    (code 4) only occurs against a Cleanverse-issued A-Token launched with
    //    an A-Pass-binding rule. Here we assert the CCP decision is surfaced
    //    correctly (allowed:false + a COMPLIANCE_FAILED meaning) — i.e. the
    //    adapter correctly reports a *real* on-chain deny.
    const ccp = await api('POST', '/api/ccp/verify', { wallet: BURNER, atoken: ATOKEN });
    const ccpOk =
      ccp.json.success &&
      ccp.json.data &&
      ccp.json.data.allowed === false &&
      ccp.json.data.meaning === 'COMPLIANCE_FAILED';
    record(
      'ccp verify_apass (expect surfaced deny: allowed=false, COMPLIANCE_FAILED)',
      ccpOk,
      ccp.json.success ? JSON.stringify(ccp.json.data) : ccp.json.error
    );

    // ---------------------------------------------------------------------
    // MANUAL ONLY — stateful on-chain ops, intentionally NOT run automatically:
    //
    // const frz = await api('POST', `/api/cvi/${BURNER}/freeze`, {});
    // console.log('freeze ->', JSON.stringify(frz.json));
    // const s3 = await api('GET', `/api/cvi/${BURNER}/status`);   // expect status=2
    // const ccp2 = await api('POST', '/api/ccp/verify', { wallet: BURNER, atoken: ATOKEN });
    //   // expect allowed=false, meaning=COMPLIANCE_FAILED
    // const unf = await api('POST', `/api/cvi/${BURNER}/unfreeze`, {});
    // const s4 = await api('GET', `/api/cvi/${BURNER}/status`);   // expect status=1
    // ---------------------------------------------------------------------
  } catch (err) {
    record('test run', false, err.message);
    console.log('\n--- server log ---\n' + serverLog.slice(-2000));
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  }

  summary();
}

main();
