import { useState, useCallback } from 'react';
import { WalletConnect } from '../components/WalletConnect';
import { RequestCard } from '../components/RequestCard';
import { StatusBadge } from '../components/StatusBadge';
import { useToasts } from '../hooks/useUtils';
import { apiClient } from '../lib/api';
import { getConsentRegistryContract } from '../hooks/ethers';
import type { AccessRequest } from '../types';

export function Researcher() {
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [queuing, setQueuing] = useState(false);
  const [settling, setSettling] = useState<string | null>(null);
  const { addToast } = useToasts();

  const fetchRequests = useCallback(async () => {
    if (!connectedWallet) return;
    try {
      const contract = await getConsentRegistryContract(null);
      const requestCount = await contract._requestIds();
      const count = Number(requestCount);
      const fetched: AccessRequest[] = [];
      for (let i = 1; i <= count; i++) {
        try {
          const req = await contract.getAccessRequest(i);
          fetched.push({
            requestId: String(i),
            consentId: String(req.consentId),
            receiptId: req.receiptId,
            researcher: req.researcher,
            studyId: req.studyId,
            purposeHash: req.purposeHash,
            queuedAt: String(req.queuedAt),
            expiresAt: String(req.expiresAt),
            compensation: req.compensation.toString(),
            status: req.status === 0 ? 'PENDING' : req.status === 1 ? 'APPROVED' : 'REJECTED',
            rejectionCode: String(req.rejectionCode || 'NONE'),
          } as AccessRequest);
        } catch {
          // Request doesn't exist
        }
      }
      setRequests(fetched);
    } catch (e) {
      console.error('Failed to fetch requests:', e);
    }
  }, [connectedWallet]);

  const handleQueueRequest = useCallback(async () => {
    if (!connectedWallet) {
      addToast('Please connect your wallet first', 'warning');
      return;
    }
    setQueuing(true);
    try {
      const contract = await getConsentRegistryContract(null);
      // In production, this would call contract.queueAccessRequest with ETH
      const newRequest: AccessRequest = {
        requestId: String(requests.length + 1),
        consentId: '1',
        receiptId: '0x' + Math.random().toString(16).slice(2, 66),
        researcher: connectedWallet,
        studyId: 'Study-001',
        purposeHash: '0x' + Math.random().toString(16).slice(2, 66),
        queuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        compensation: '0.01',
        status: 'PENDING',
        rejectionCode: 'NONE',
      };
      setRequests((prev) => [...prev, newRequest]);
      addToast('Access request queued!', 'success');
    } catch (e) {
      addToast('Failed to queue access request', 'error');
    } finally {
      setQueuing(false);
    }
  }, [connectedWallet, requests.length, addToast]);

  const handleSettleRequest = useCallback(async (requestId: string) => {
    setSettling(requestId);
    try {
      // In production, this would call contract.settleAccessRequest
      // and verify CCP before settling
      await apiClient.verifyCcp(connectedWallet || '');
      
      setRequests((prev) =>
        prev.map((r) =>
          r.requestId === requestId ? { ...r, status: 'APPROVED' } : r
        )
      );
      addToast('Access request approved!', 'success');
    } catch (e) {
      addToast('Failed to settle request', 'error');
    } finally {
      setSettling(null);
    }
  }, [connectedWallet, addToast]);

  const handleConnected = useCallback((wallet: string) => {
    setConnectedWallet(wallet);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Researcher</h1>
          <p className="text-gray-400 mt-1">
            Queue and manage access requests for clinical data with ETH compensation.
          </p>
        </div>
        <WalletConnect connectLabel="Connect MetaMask" onConnected={handleConnected} />
      </div>

      {connectedWallet && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-1">Connected</h3>
            <p className="text-xs font-mono text-emerald-400 break-all">
              {connectedWallet.slice(0, 10)}...{connectedWallet.slice(-8)}
            </p>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-1">Pending Requests</h3>
            <p className="text-2xl font-bold text-white">
              {requests.filter((r) => r.status === 'PENDING').length}
            </p>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-1">Approved</h3>
            <p className="text-2xl font-bold text-emerald-400">
              {requests.filter((r) => r.status === 'APPROVED').length}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span>🔬</span> Your Actions
        </h2>
        <button
          onClick={handleQueueRequest}
          disabled={queuing}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {queuing ? '⏳ Queuing...' : '📤'} Queue Access Request
        </button>
      </div>

      {connectedWallet && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span>📊</span> Access Requests
          </h2>
          {requests.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/40 border border-dashed border-gray-700 rounded-xl">
              <p className="text-gray-400">No access requests yet. Queue one to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {requests.map((request) => (
                <RequestCard
                  key={request.requestId}
                  request={request}
                  onSettle={handleSettleRequest}
                  canSettle={true}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
