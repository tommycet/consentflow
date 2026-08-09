import { useState, useCallback, useRef, useEffect } from 'react';
import { ethers } from 'ethers';
import type { ApiEnvelope, ConsentStatus, RequestStatus } from '../types';

// ─── Notification State ──────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  details?: string;
}

let toastIdCounter = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'info', details?: string) => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, message, variant, details }]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timersRef.current.delete(id);
      }, 5000);
      timersRef.current.set(id, timer);
      return id;
    },
    [],
  );

  const clearToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    timersRef.current.delete(id);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return { toasts, addToast, clearToast };
}

// ─── Polling Hook ────────────────────────────────────────────────────

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs = 3000,
  enabled = true,
): { data: T | null; error: string | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const result = await fetchFn();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    tick();
    timerRef.current = setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchFn, intervalMs, enabled]);

  return { data, error, loading };
}

// ─── Status display helpers ──────────────────────────────────────────

export function ConsentStatusLabel(status: number | ConsentStatus): { label: string; color: string } {
  const s = typeof status === 'number' ? status : (['NONE', 'ACTIVE', 'REVOKED'] as const).indexOf(status as any);
  const labels: Record<number, { label: string; color: string }> = {
    0: { label: 'None', color: 'bg-gray-700 text-gray-300' },
    1: { label: 'Active', color: 'bg-emerald-900/50 text-emerald-400 border border-emerald-700' },
    2: { label: 'Revoked', color: 'bg-red-900/30 text-red-400 border border-red-700' },
  };
  return labels[s] ?? { label: 'Unknown', color: 'bg-gray-700 text-gray-300' };
}

export function RequestStatusLabel(status: number | RequestStatus): { label: string; color: string } {
  const s =
    typeof status === 'number'
      ? status
      : (['PENDING', 'APPROVED', 'REJECTED'] as const).indexOf(status as any);
  const labels: Record<number, { label: string; color: string }> = {
    0: { label: 'Pending', color: 'bg-yellow-900/50 text-yellow-400 border border-yellow-700' },
    1: { label: 'Approved', color: 'bg-emerald-900/50 text-emerald-400 border border-emerald-700' },
    2: { label: 'Rejected', color: 'bg-red-900/30 text-red-400 border border-red-700' },
  };
  return labels[s] ?? { label: 'Unknown', color: 'bg-gray-700 text-gray-300' };
}

export function truncateAddress(address: string | undefined): string {
  if (!address || address === '0x') return '—';
  if (address.length !== 42) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function shortHash(hash: string | undefined, chars = 10): string {
  if (!hash) return '—';
  if (hash.length <= chars * 2 + 4) return hash;
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}
