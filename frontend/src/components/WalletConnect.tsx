import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';

// ─── Wallet Connect Hook ───────────────────────────────────────────

export interface WalletState {
  address: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  chainId: number | null;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    provider: null,
    signer: null,
    chainId: null,
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not detected. Please install MetaMask.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      setWallet({
        address: accounts[0] || (await signer.getAddress()),
        provider,
        signer,
        chainId: Number(network.chainId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({ address: null, provider: null, signer: null, chainId: null });
  }, []);

  return { wallet, connecting, error, connect, disconnect };
}

// ─── WalletConnect Component ────────────────────────────────────────

export interface WalletConnectProps {
  className?: string;
  connectLabel?: string;
  onConnected?: (wallet: string) => void;
}

export function WalletConnect({ className = '', connectLabel = 'Connect MetaMask', onConnected }: WalletConnectProps) {
  const { wallet, connecting, error, connect, disconnect } = useWallet();

  // Notify parent when wallet connects
  const handleConnect = useCallback(async () => {
    await connect();
  }, [connect]);

  // Fire onConnected callback after address changes
  useEffect(() => {
    if (wallet.address && onConnected) {
      onConnected(wallet.address);
    }
  }, [wallet.address, onConnected]);

  if (wallet.address) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="px-4 py-2 rounded-lg bg-emerald-900/30 border border-emerald-700 text-emerald-300 text-sm font-mono">
          {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
        </div>
        {wallet.chainId && wallet.chainId !== 10143 && (
          <span className="text-yellow-400 text-xs">⚠ Monad Testnet required</span>
        )}
        <button
          onClick={disconnect}
          className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button
        onClick={connect}
        disabled={connecting}
        className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition shadow-lg shadow-emerald-900/30"
      >
        {connecting ? 'Connecting…' : connectLabel}
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
