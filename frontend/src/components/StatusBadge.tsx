import { useState, useEffect, useCallback, ReactNode } from 'react';
import { apiClient } from '../lib/api';
import { useToasts } from '../hooks/useUtils';
import { ToastVariant } from '../hooks/useUtils';

// ─── Wallet Connect ──────────────────────────────────────

interface WalletConnectProps {
  connectLabel?: string;
  onConnected?: (wallet: string) => void;
}

export function WalletConnect({ connectLabel = 'Connect MetaMask', onConnected }: WalletConnectProps) {
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToasts();

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask and try again.');
      addToast('MetaMask is not installed', 'error');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      await (window as any).ethereum?.request({ method: 'eth_requestAccounts' });
      const provider = (window as any).ethereum.provider as any;
      const address = (provider as any).address;
      setAddress(address);
      if (onConnected) onConnected(address);
      addToast('Wallet connected successfully', 'success');
    } catch (e: unknown) {
      setError('Failed to connect wallet. Please try again.');
      addToast('Wallet connection failed', 'error');
      console.error('Wallet connection error:', e);
    } finally {
      setConnecting(false);
    }
  }, [onConnected]);

  const disconnect = useCallback(() => {
    setAddress(null);
    addToast('Wallet disconnected', 'info');
  }, [addToast]);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={connect}
        disabled={connecting}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          connecting
            ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30'
        }`}
      >
        {connecting ? 'Connecting...' : connectLabel}
      </button>
      {address && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/80 rounded-lg border border-gray-700">
          <span className="text-xs text-gray-300 font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
          <button onClick={disconnect} className="text-gray-400 hover:text-white" aria-label="Disconnect">
            ✕
          </button>
        </div>
      )}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────

export type ConsentStatus = 'NONE' | 'ACTIVE' | 'REVOKED';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StatusBadgeProps {
  status: string | number;
  variant?: 'default' | 'success' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, variant = 'default', size = 'md' }: StatusBadgeProps) {
  const isActive = status === 'ACTIVE' || status === 1;
  const isRevoked = status === 'REVOKED' || status === 2;
  const isPending = status === 'PENDING' || status === 0;

  const labels: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: 'Active', color: 'bg-emerald-500' },
    REVOKED: { label: 'Revoked', color: 'bg-red-500' },
    PENDING: { label: 'Pending', color: 'bg-yellow-500' },
    APPROVED: { label: 'Approved', color: 'bg-emerald-500' },
    REJECTED: { label: 'Rejected', color: 'bg-red-500' },
    EXPIRED: { label: 'Expired', color: 'bg-gray-500' },
    NONE: { label: 'None', color: 'bg-gray-600' },
  };

  const label = labels[status as keyof typeof labels]?.label || status;
  const color = labels[status as keyof typeof labels]?.color || 'bg-gray-600';

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color} text-white`}>
        {label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${color} text-white shadow-sm`}>
      {label}
    </span>
  );
}
