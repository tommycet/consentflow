import { ethers } from 'ethers';
import type { Wallet } from 'ethers';
import type { Contract } from 'ethers';
import { CONFIG } from '../lib/config';
import { apiClient } from '../lib/api';

// ─── Ethers Provider ────────────────────────────────────────

export function getProvider(): ethers.JsonRpcProvider {
  // ethers v6 rejects a bare `{ chainId }` object as a Network — it must be a
  // name, a chainId number/bigint, or a Network instance. Passing the object
  // threw INVALID_ARGUMENT on every read and write.
  return new ethers.JsonRpcProvider(CONFIG.rpcUrl, CONFIG.chainId);
}

export function getWallet(): ethers.Wallet | null {
  // MetaMask / injected provider
  const provider = (window as any).ethereum;
  if (!provider || !provider.provider) return null;

  const walletAddress = (provider as any).address || null;
  return new ethers.Wallet(walletAddress || ethers.ZeroAddress, provider as any);
}

// ─── Contract Proxies ──────────────────────────────────────

export async function getConsentRegistryContract(
  wallet?: ethers.Wallet | null,
  rpcProvider?: ethers.Provider
): Promise<ethers.Contract> {
  const provider = rpcProvider || getProvider();
  const contractAddress = CONFIG.contract.consentRegistry;
  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000') {
    throw new Error('ConsentRegistry address not configured. Set VITE_CONSENT_REGISTRY_ADDRESS.');
  }

  const abi = (CONFIG.abi as any).ConsentRegistry;

  // A Signer must be attached for write calls. Attaching `wallet.provider`
  // yields a read-only contract, so every tx silently fails to send.
  if (wallet) {
    return new ethers.Contract(contractAddress, abi, wallet);
  }
  return new ethers.Contract(contractAddress, abi, provider);
}

export async function getContributionReceiptContract(
  wallet?: ethers.Wallet | null,
  rpcProvider?: ethers.Provider
): Promise<ethers.Contract> {
  const provider = rpcProvider || getProvider();
  const contractAddress = CONFIG.contract.contributionReceipt;
  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000') {
    throw new Error('ContributionReceipt address not configured. Set VITE_CONTRIBUTION_RECEIPT_ADDRESS.');
  }

  const signerOrProvider = wallet || provider;
  const abi = (CONFIG.abi as any).ContributionReceipt;

  if (wallet) {
    return new ethers.Contract(contractAddress, abi, wallet);
  }
  return new ethers.Contract(contractAddress, abi, provider);
}

// ─── Demo Wallet Factory ───────────────────────────────────────────

export function createDemoWallet(): {
  wallet: ethers.Wallet;
  provider: ethers.JsonRpcProvider;
} {
  const provider = getProvider();
  const wallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
  return { wallet, provider };
}
