/**
 * Integration test wrapper for CI.
 * Boots the backend server and runs the existing adapter integration tests.
 *
 * Usage in CI:
 *   ALLOW_NO_CREDS=1 node test/integration.test.js
 */
const { spawn } = require('child_process');
const path = require('path');

// Re-use the existing integration test suite.
require('../test-adapter.js');
