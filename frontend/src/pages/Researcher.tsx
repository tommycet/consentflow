import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
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
  const [consentIdInput, setConsentIdInput] = useState('1');
  const [compensationInput, setCompensationInput] = useState('0.01');
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

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const parseConsent = async (consentId: string) => {
    const contract = await getConsentRegistryContract(null);
    const c = await contract.getConsent(consentId);
    return {
      studyId: c.studyId,
      purposeHash: c.purposeHash,
    };
  };

  const handleQueueRequest = useCallback(async () => {
    if (!connectedWallet) {
      addToast('Please connect your wallet first', 'warning');
      return;
    }
    setQueuing(true);
    try {
      const contract = await getConsentRegistryContract(window.__wallet || null);
      const consentId = parseInt(consentIdInput, 10);
      const compensation = compensationInput;
      const { studyId, purposeHash } = await parseConsent(String(consentId));

      const tx = await contract.queueAccessRequest(
        consentId,
        studyId,
        purposeHash,
        { value: ethers.parseEther(compensation) }
      );
      await tx.wait();
      addToast('Access request queued on-chain!', 'success');
      fetchRequests();
    } catch (e: any) {
      addToast(`Failed to queue access request: ${e.message || e}`, 'error');
    } finally {
      setQueuing(false);
    }
  }, [connectedWallet, consentIdInput, compensationInput, addToast, fetchRequests]);

  const handleSettleRequest = useCallback(async (requestId: string) => {
    if (!connectedWallet) {
      addToast('Please connect your wallet first', 'warning');
      return;
    }
    setSettling(requestId);
    try {
      const wallet = window.__wallet || null;
      const contract = await getConsentRegistryContract(wallet);

      // Run CCP check via backend before settling
      const ccpResult = await apiClient.verifyCcp(connectedWallet);
      const ccpPassed = ccpResult.success && ccpResult.data?.compliant === true;
      const reasonCode = ccpPassed ? ethers.encodeBytes32String('APPROVED') : ethers.encodeBytes32String('CVI_FROZEN');

      const tx = await contract.settleAccessRequest(requestId, ccpPassed, reasonCode);
      await tx.wait();
      addToast('Access request settled on-chain!', 'success');
      fetchRequests();
    } catch (e: any) {
      addToast(`Failed to settle request: ${e.message || e}`, 'error');
    } finally {
      setSettling(null);
    }
  }, [connectedWallet, addToast, fetchRequests]);

  const handleConnected = useCallback((wallet: string, signer: any) => {
    setConnectedWallet(wallet);
    (window as any).__wallet = signer;
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
        <>
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

          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-xl font-semibold text-white">Queue Access Request</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-gray-400">Consent ID</span>
                <input
                  type="number"
                  value={consentIdInput}
                  onChange={(e) => setConsentIdInput(e.target.value)}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-400">Compensation (ETH)</span>
                <input
                  type="text"
                  value={compensationInput}
                  onChange={(e) => setCompensationInput(e.target.value)}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </label>
            </div>
            <button
              onClick={handleQueueRequest}
              disabled={queuing}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {queuing ? '⏳ Queuing...' : '📤'} Queue On-Chain
            </button>
          </div>
        </>
      )}

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
