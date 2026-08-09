/**
 * ConsentFlow Backend Integration Tests
 * Run: node test/api.test.js
 * No external framework — uses Node.js assert + child_process
 */
const assert = require('assert');
const http = require('http');
const { execSync, spawn } = require('child_process');

const PORT = 4001;
const BASE = `http://localhost:${PORT}`;

let serverProcess = null;
let passed = 0;
let failed = 0;

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      `${BASE}${path}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data ? Buffer.byteLength(data) : 0,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body || '{}') });
          } catch {
            resolve({ status: res.statusCode, body: { raw: body } });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

async function run() {
  console.log('\nConsentFlow Backend Integration Tests\n');

  // Start server on test port
  console.log('Starting test server...');
  process.env.PORT = PORT;
  process.env.ALLOW_NO_CREDS = '1';
  process.env.NODE_ENV = 'test';

  serverProcess = spawn('node', ['index.js'], {
    cwd: __dirname + '/..',
    env: { ...process.env, PORT: String(PORT), ALLOW_NO_CREDS: '1' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // ═══ Health ═══
  console.log('\n── Health ──');
  await test('GET /api/health returns success=true', async () => {
    const r = await httpRequest('GET', '/api/health');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.success, true);
    assert.strictEqual(r.body.data.service, 'consentflow-cleanverse-adapter');
  });

  // ═══ Error Handling ═══
  console.log('\n── Error Handling ──');
  await test('GET unknown route returns 404 with {success:false}', async () => {
    const r = await httpRequest('GET', '/api/nonexistent');
    assert.strictEqual(r.status, 404);
    assert.strictEqual(r.body.success, false);
    assert.ok(r.body.error.includes('unknown route'));
  });

  await test('POST without body to write endpoint returns error', async () => {
    const r = await httpRequest('POST', '/api/cvi/generate', null);
    assert.ok(r.body.success === false || r.status >= 400);
  });

  // ═══ Contract Endpoints ═══
  console.log('\n── Contract Endpoints ──');
  await test('GET /api/contract/events returns success with array', async () => {
    const r = await httpRequest('GET', '/api/contract/events');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.success, true);
    assert.ok(Array.isArray(r.body.data.events));
  });

  await test('GET /api/contract/stats returns success with stats object', async () => {
    const r = await httpRequest('GET', '/api/contract/stats');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.success, true);
    assert.ok(typeof r.body.data.totalConsents === 'number');
    assert.ok(typeof r.body.data.activeConsents === 'number');
  });

  await test('GET /api/contract/consents/:address with valid address', async () => {
    const r = await httpRequest('GET', '/api/contract/consents/0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.success, true);
    assert.ok(Array.isArray(r.body.data.consentIds));
  });

  await test('GET /api/contract/consents/:address with invalid address returns error', async () => {
    const r = await httpRequest('GET', '/api/contract/consents/0xinvalid');
    assert.strictEqual(r.body.success, false);
  });

  // ═══ Validation ═══
  console.log('\n── Validation ──');
  await test('Invalid address on consents endpoint', async () => {
    const r = await httpRequest('GET', '/api/contract/consents/not-an-address');
    assert.strictEqual(r.body.success, false);
  });

  // ═══ Event Filtering ═══
  console.log('\n── Event Filtering ──');
  await test('GET /api/contract/events?type=ConsentCreated filters by type', async () => {
    const r = await httpRequest('GET', '/api/contract/events?type=ConsentCreated');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.success, true);
    assert.ok(Array.isArray(r.body.data.events));
    // All returned events should be ConsentCreated (or empty)
    for (const e of r.body.data.events) {
      assert.strictEqual(e.type, 'ConsentCreated');
    }
  });

  // ═══ Summary ═══
  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ${failed === 0 ? '✓ ALL PASS' : '✗ FAILURES'} ═══\n`);

  if (serverProcess) serverProcess.kill('SIGTERM');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal:', err);
  if (serverProcess) serverProcess.kill('SIGTERM');
  process.exit(1);
});
