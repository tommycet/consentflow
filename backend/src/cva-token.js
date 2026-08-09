/**
 * CVA (A-Token / aUSDC) helper module.
 *
 * Wraps on-chain reads and writes for the Cleanverse A-Token (aUSDC) on Monad testnet
 * using the AccessCore (ATokenManager) contract address. Falls back to direct ethers
 * contract calls when the Cleanverse API does not expose the needed endpoint.
 *
 * All reads are against the on-chain contract; writes (transfer/approve) require
 * DEPLOYER_PRIVATE_KEY to be set in .env.
 */

const { ethers } = require('ethers');
const CVA_ABI = require('./cva-abi');
const { getProvider, getWallet, RPC_URL } = require('./ethers-provider');

// ----- env-derived config -----
const ATOKEN_ADDRESS = process.env.ATOKEN_ADDRESS || '';
const ACCESSCORE_ADDRESS = process.env.ACCESSCORE_ADDRESS || '';

// ----- lazy singletons -----
let _atokenContract = null;
let _accessCoreContract = null;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required — set it in .env or export it before calling this function.`);
  }
  return value;
}

function getAtokenContract() {
  if (!_atokenContract) {
    const address = requireEnv('ATOKEN_ADDRESS', ATOKEN_ADDRESS);
    // Use read-only provider for balance queries; wallet for writes.
    const provider = getProvider();
    _atokenContract = new ethers.Contract(address, CVA_ABI, provider);
  }
  return _atokenContract;
}

function getAccessCoreContract() {
  if (!_accessCoreContract) {
    const address = requireEnv('ACCESSCORE_ADDRESS', ACCESSCORE_ADDRESS);
    // AccessCore interaction may need wallet for writes; use provider for reads.
    const provider = getProvider();
    // Minimal ABI for AccessCore - focus on transfer/approve related functions if needed
    const accessCoreAbi = [
      ...CVA_ABI,
      {
        type: 'function',
        name: 'transfer',
        inputs: [
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
        stateMutability: 'nonpayable',
      },
    ];
    _accessCoreContract = new ethers.Contract(address, accessCoreAbi, provider);
  }
  return _accessCoreContract;
}

/**
 * Get aUSDC balance for a wallet via on-chain read.
 * @param {string} wallet
 * @returns {Promise<string>} balance as a decimal string (wei units, 6 decimals for USDC)
 */
async function getAtokenBalance(wallet) {
  const { valid, address, error } = normalizeAddress(wallet);
  if (!valid) throw new Error(error);

  const contract = getAtokenContract();
  const raw = await contract.balanceOf(address);
  return raw.toString();
}

/**
 * Transfer aUSDC from the backend wallet to a recipient.
 * Requires DEPLOYER_PRIVATE_KEY in .env.
 * @param {string} to
 * @param {string} amount - raw token units (e.g. "1000000" for 1 USDC with 6 decimals)
 * @returns {Promise<ethers.TransactionResponse>}
 */
async function transferAtoken(to, amount) {
  const { valid: toValid, address: toAddr, error: toError } = normalizeAddress(to);
  if (!toValid) throw new Error(toError);

  const wallet = getWallet();
  const contract = getAtokenContract().connect(wallet);
  const tx = await contract.transfer(toAddr, BigInt(amount));
  return tx;
}

/**
 * Approve AccessCore (or any spender) to spend aUSDC on behalf of the backend wallet.
 * Requires DEPLOYER_PRIVATE_KEY in .env.
 * @param {string} spender
 * @param {string} amount - raw token units
 * @returns {Promise<ethers.TransactionResponse>}
 */
async function approveAtoken(spender, amount) {
  const { valid: sValid, address: spenderAddr, error: sError } = normalizeAddress(spender);
  if (!sValid) throw new Error(sError);

  const wallet = getWallet();
  const contract = getAtokenContract().connect(wallet);
  const tx = await contract.approve(spenderAddr, BigInt(amount));
  return tx;
}

/**
 * Get aUSDC allowance for an owner + spender pair.
 * @param {string} owner
 * @param {string} spender
 * @returns {Promise<string>} allowance as raw token units string
 */
async function getAtokenAllowance(owner, spender) {
  const { valid: oValid, address: ownerAddr, error: oError } = normalizeAddress(owner);
  if (!oValid) throw new Error(oError);
  const { valid: sValid, address: spenderAddr, error: sError } = normalizeAddress(spender);
  if (!sValid) throw new Error(sError);

  const contract = getAtokenContract();
  const raw = await contract.allowance(ownerAddr, spenderAddr);
  return raw.toString();
}

/**
 * Transfer aUSDC via AccessCore contract (CVA-bound data compensation).
 * This simulates purpose-bound transfer through the AccessCore wrapper instead of raw ERC20.
 * Requires DEPLOYER_PRIVATE_KEY in .env.
 * @param {string} to
 * @param {string} amount
 * @returns {Promise<ethers.TransactionResponse>}
 */
async function transferAtokenViaAccessCore(to, amount) {
  const { valid: toValid, address: toAddr, error: toError } = normalizeAddress(to);
  if (!toValid) throw new Error(toError);

  const wallet = getWallet();
  const contract = getAccessCoreContract().connect(wallet);
  const tx = await contract.transfer(toAddr, BigInt(amount));
  return tx;
}

// ----- helpers -----
function normalizeAddress(raw) {
  const s = String(raw || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) {
    return { valid: false, address: null, error: `invalid wallet address: ${raw}` };
  }
  return { valid: true, address: s.toLowerCase(), error: null };
}

module.exports = {
  getAtokenBalance,
  transferAtoken,
  approveAtoken,
  getAtokenAllowance,
  transferAtokenViaAccessCore,
  ATOKEN_ADDRESS,
  ACCESSCORE_ADDRESS,
};
