import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';

const DEMO_FAUCET_KEY = '180e533e588125118132a37e3c60fce5b985367708ff927bb4d078d4e95ff314';

export interface WalletState {
  address: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | ethers.Wallet | null;
  chainId: number | null;
  isDemoWallet?: boolean;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    provider: null,
    signer: null,
    chainId: null,
    isDemoWallet: false,
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectDemo = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const jsonRpcProvider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
      const demoSigner = new ethers.Wallet(DEMO_FAUCET_KEY, jsonRpcProvider);
      const network = await jsonRpcProvider.getNetwork();
      setWallet({
        address: demoSigner.address,
        provider: null,
        signer: demoSigner,
        chainId: Number(network.chainId),
        isDemoWallet: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect showcase wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not detected. Please install MetaMask or use the Demo Showcase Wallet.');
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
        isDemoWallet: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({ address: null, provider: null, signer: null, chainId: null, isDemoWallet: false });
  }, []);

  return { wallet, connecting, error, connect, connectDemo, disconnect };
}

export interface WalletConnectProps {
  className?: string;
  connectLabel?: string;
  onConnected?: (wallet: string) => void;
}

export function WalletConnect({ className = '', connectLabel = 'Connect MetaMask', onConnected }: WalletConnectProps) {
  const { wallet, connecting, error, connect, connectDemo, disconnect } = useWallet();

  // Expose the live signer so pages can send real transactions with the
  // connected account (showcase wallet or MetaMask), then notify the parent.
  useEffect(() => {
    if (wallet.address) {
      (window as unknown as { __wallet?: unknown }).__wallet = wallet.signer;
      if (onConnected) onConnected(wallet.address);
    }
  }, [wallet.address, wallet.signer, onConnected]);

  if (wallet.address) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="px-4 py-2 rounded-lg bg-emerald-900/30 border border-emerald-700 text-emerald-300 text-sm font-mono flex items-center gap-2">
          {wallet.isDemoWallet && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" title="Showcase Wallet"></span>}
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
      <div className="flex gap-2">
        <button
          onClick={connect}
          disabled={connecting}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition shadow-lg shadow-emerald-900/30"
        >
          {connecting ? 'Connecting…' : connectLabel}
        </button>
        <button
          onClick={connectDemo}
          disabled={connecting}
          className="px-4 py-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800 text-cyan-300 text-sm font-medium transition"
        >
          Use Showcase Wallet
        </button>
      </div>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
