import { ethers } from 'ethers';
import type { Wallet } from 'ethers';
import type { Contract } from 'ethers';
import { CONFIG } from '../lib/config';
import { apiClient } from '../lib/api';

// ─── Ethers Provider ────────────────────────────────────────

export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(CONFIG.rpcUrl, {
    chainId: CONFIG.chainId,
  });
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
  const signerOrProvider = wallet || provider;

  if (wallet && wallet.provider) {
    return new ethers.Contract(contractAddress, abi, wallet.provider);
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
    throw new Error('ContributionReceipt address not configured. Set VITE_CONTIBUTION_RECEIPT_ADDRESS.');
  }

  const signerOrProvider = wallet || provider;
  const abi = (CONFIG.abi as any).ContributionReceipt;

  if (wallet && wallet.provider) {
    return new ethers.Contract(contractAddress, abi, wallet.provider);
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
