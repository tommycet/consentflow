/**
 * Ethers v6 provider + contract instances for ConsentFlow on-chain integration.
 *
 * All addresses and keys come from env vars — nothing is hardcoded.
 * The generated ABIs are missing mutating functions, so we supplement them
 * with minimal function descriptors derived from the Solidity source.
 *
 * On module load we only READ env vars; getters throw only when CALLED if
 * a required value is missing, so the server can boot without all creds.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ----- env-derived config -----
const RPC_URL = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const CONSENT_REGISTRY_ADDRESS = process.env.CONSENT_REGISTRY_ADDRESS;
const CONTRIBUTION_RECEIPT_ADDRESS = process.env.CONTRIBUTION_RECEIPT_ADDRESS;

// ----- ABI loader with missing-method supplement -----
function loadAbi(relativePath) {
  const full = path.join(__dirname, '..', relativePath);
  const generated = JSON.parse(fs.readFileSync(full, 'utf8'));

  // The generated ABIs omit mutating functions. Append minimal descriptors
  // that match the Solidity source / I*.sol interfaces exactly.
  const supplement = generated.find((i) => i.name === 'createConsent')
    ? []
    : [
        // ConsentRegistry mutating functions
        {
          inputs: [
            { name: 'cviAttestationHash', type: 'bytes32' },
            { name: 'studyId', type: 'bytes32' },
            { name: 'purposeHash', type: 'bytes32' },
            { name: 'policyVersion', type: 'bytes32' },
            { name: 'expiresAt', type: 'uint64' },
            { name: 'receiptData', type: 'bytes' },
          ],
          name: 'createConsent',
          outputs: [
            { name: '', type: 'uint256' },
            { name: '', type: 'uint256' },
          ],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            { name: 'consentId', type: 'uint256' },
            { name: 'studyId', type: 'bytes32' },
            { name: 'purposeHash', type: 'bytes32' },
            { name: 'expiresAt', type: 'uint64' },
          ],
          name: 'queueAccessRequest',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'payable',
          type: 'function',
        },
        {
          inputs: [
            { name: 'requestId', type: 'uint256' },
            { name: 'ccpPassed', type: 'bool' },
            { name: 'reasonCode', type: 'bytes32' },
          ],
          name: 'settleAccessRequest',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        // ContributionReceipt mutating functions (if missing)
        {
          inputs: [
            { name: 'participant', type: 'address' },
            { name: 'consentId', type: 'uint256' },
            { name: 'fixtureHash', type: 'bytes32' },
            { name: 'studyId', type: 'bytes32' },
            { name: 'purposeHash', type: 'bytes32' },
            { name: 'policyVersion', type: 'bytes32' },
            { name: 'expiresAt', type: 'uint64' },
          ],
          name: 'issue',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [{ name: 'receiptId', type: 'uint256' }],
          name: 'revoke',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ];

  return [...generated, ...supplement];
}

// ----- lazy singletons -----
let _provider = null;
let _wallet = null;
let _consentRegistry = null;
let _contributionReceipt = null;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required — set it in .env or export it before starting the server.`);
  }
  return value;
}

/** JsonRpcProvider — throws only when first requested. */
function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return _provider;
}

/** Signing wallet — throws on first call if DEPLOYER_PRIVATE_KEY missing. */
function getWallet() {
  if (!_wallet) {
    const key = requireEnv('DEPLOYER_PRIVATE_KEY', DEPLOYER_KEY);
    _wallet = new ethers.Wallet(key, getProvider());
  }
  return _wallet;
}

function getConsentRegistry() {
  if (!_consentRegistry) {
    const address = requireEnv('CONSENT_REGISTRY_ADDRESS', CONSENT_REGISTRY_ADDRESS);
    const abi = loadAbi('frontend/generated/abis/ConsentRegistry.json');
    _consentRegistry = new ethers.Contract(address, abi, getWallet());
  }
  return _consentRegistry;
}

function getContributionReceipt() {
  if (!_contributionReceipt) {
    const address = requireEnv('CONTRIBUTION_RECEIPT_ADDRESS', CONTRIBUTION_RECEIPT_ADDRESS);
    const abi = loadAbi('frontend/generated/abis/ContributionReceipt.json');
    _contributionReceipt = new ethers.Contract(address, abi, getWallet());
  }
  return _contributionReceipt;
}

let _cvaToken = null;
function getCvaToken() {
  if (!_cvaToken) {
    const address = requireEnv('ATOKEN_ADDRESS', ATOKEN_ADDRESS);
    // Minimal ERC-20 ABI for balance check
    const erc20Abi = [
      'function balanceOf(address account) external view returns (uint256)',
      'function decimals() external view returns (uint8)',
    ];
    _cvaToken = new ethers.Contract(address, erc20Abi, getWallet());
  }
  return _cvaToken;
}

module.exports = {
  getProvider,
  getWallet,
  getConsentRegistry,
  getContributionReceipt,
  getCvaToken,
  loadAbi,
  RPC_URL,
};
