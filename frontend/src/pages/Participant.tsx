import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { WalletConnect } from '../components/WalletConnect';
import { ConsentCard } from '../components/ConsentCard';
import { StatusBadge } from '../components/StatusBadge';
import { useToasts } from '../hooks/useUtils';
import { apiClient } from '../lib/api';
import { getConsentRegistryContract } from '../hooks/ethers';
import type { ConsentRecord } from '../types';

export function Participant() {
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [cviStatus, setCviStatus] = useState<any>(null);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [studyIdInput, setStudyIdInput] = useState('Study-001');
  const [purposeInput, setPurposeInput] = useState('genomic-research');
  const { addToast } = useToasts();

  const fetchConsents = useCallback(async () => {
    if (!connectedWallet) return;
    try {
      const contract = await getConsentRegistryContract(null);
      const consentCount = await contract._consentIds();
      const count = Number(consentCount);
      const fetched: ConsentRecord[] = [];
      for (let i = 1; i <= count; i++) {
        try {
          const consent = await contract.getConsent(i);
          if (consent.participant.toLowerCase() === connectedWallet.toLowerCase()) {
            fetched.push({
              consentId: String(i),
              participant: consent.participant,
              cviAttestationHash: consent.cviAttestationHash,
              receiptId: consent.receiptId,
              studyId: consent.studyId,
              purposeHash: consent.purposeHash,
              policyVersion: consent.policyVersion,
              createdAt: String(consent.createdAt),
              expiresAt: String(consent.expiresAt),
              revokedAt: String(consent.revokedAt || '0'),
              status: consent.status === 1 ? 'ACTIVE' : consent.status === 2 ? 'REVOKED' : 'NONE',
            } as ConsentRecord);
          }
        } catch {
          // Consent doesn't exist
        }
      }
      setConsents(fetched);
    } catch (e) {
      console.error('Failed to fetch consents:', e);
    }
  }, [connectedWallet]);

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  const handleGenerateApass = useCallback(async () => {
    if (!connectedWallet) {
      addToast('Please connect your wallet first', 'warning');
      return;
    }
    setGenerating(true);
    try {
      const result = await apiClient.generateApass(connectedWallet);
      setCviStatus(result);
      addToast(`A-Pass generated! Tier: ${result.tier}`, 'success');
    } catch (e) {
      addToast('Failed to generate A-Pass', 'error');
    } finally {
      setGenerating(false);
    }
  }, [connectedWallet, addToast]);

  const handleCreateConsent = useCallback(async () => {
    if (!connectedWallet) {
      addToast('Please connect your wallet first', 'warning');
      return;
    }
    setCreating(true);
    try {
      const wallet = (window as any).__wallet || null;
      const contract = await getConsentRegistryContract(wallet);

      // Generate real cryptographic hashes from actual user input
      const cviAttestationHash = ethers.keccak256(ethers.toUtf8Bytes(`cvi-${connectedWallet}-${Date.now()}`));
      const studyId = ethers.keccak256(ethers.toUtf8Bytes(studyIdInput));
      const purposeHash = ethers.keccak256(ethers.toUtf8Bytes(purposeInput));
      const policyVersion = ethers.encodeBytes32String('v1.0');
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60); // 1 year
      const receiptData = new Uint8Array(0);

      const tx = await contract.createConsent(
        cviAttestationHash,
        studyId,
        purposeHash,
        policyVersion,
        expiresAt,
        receiptData
      );
      await tx.wait();
      addToast('Consent created on-chain!', 'success');
      fetchConsents();
    } catch (e: any) {
      addToast(`Failed to create consent: ${e.message || e}`, 'error');
    } finally {
      setCreating(false);
    }
  }, [connectedWallet, studyIdInput, purposeInput, addToast, fetchConsents]);

  const handleRevokeConsent = useCallback(async (consentId: string) => {
    setRevoking(consentId);
    try {
      const wallet = (window as any).__wallet || null;
      const contract = await getConsentRegistryContract(wallet);
      const tx = await contract.revokeConsent(parseInt(consentId, 10));
      await tx.wait();
      addToast('Consent revoked on-chain', 'success');
      fetchConsents();
    } catch (e: any) {
      addToast(`Failed to revoke consent: ${e.message || e}`, 'error');
    } finally {
      setRevoking(null);
    }
  }, [addToast, fetchConsents]);

  const handleConnected = useCallback((wallet: string, signer: any) => {
    setConnectedWallet(wallet);
    (window as any).__wallet = signer;
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Participant</h1>
          <p className="text-gray-400 mt-1">
            Manage your clinical trial consent with full control.
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
            <h3 className="text-sm font-medium text-gray-400 mb-1">A-Pass Status</h3>
            {cviStatus ? (
              <div className="flex items-center gap-2">
                <StatusBadge status={cviStatus.tier > 0 ? 'ACTIVE' : 'NONE'} />
                <span className="text-sm text-gray-300">Tier {cviStatus.tier}</span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not generated</p>
            )}
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-1">Active Consents</h3>
            <p className="text-2xl font-bold text-white">
              {consents.filter((c) => c.status === 'ACTIVE').length}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span>📋</span> Your Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenerateApass}
            disabled={generating}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {generating ? '⏳ Generating...' : '🪪'} Generate A-Pass
          </button>
        </div>
        {connectedWallet && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="text-lg font-semibold text-white">Create Consent On-Chain</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-gray-400">Study ID</span>
                <input
                  type="text"
                  value={studyIdInput}
                  onChange={(e) => setStudyIdInput(e.target.value)}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-400">Purpose</span>
                <input
                  type="text"
                  value={purposeInput}
                  onChange={(e) => setPurposeInput(e.target.value)}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </label>
            </div>
            <button
              onClick={handleCreateConsent}
              disabled={creating}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {creating ? '⏳ Creating...' : '✅'} Create On-Chain
            </button>
          </div>
        )}
      </div>

      {connectedWallet && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span>📄</span> Your Consents
          </h2>
          {consents.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/40 border border-dashed border-gray-700 rounded-xl">
              <p className="text-gray-400">No consents yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {consents.map((consent) => (
                <ConsentCard
                  key={consent.consentId}
                  consent={consent}
                  onRevoke={handleRevokeConsent}
                  canRevoke={true}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
