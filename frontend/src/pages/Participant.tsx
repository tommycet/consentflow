import { useState, useCallback } from 'react';
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
  const { addToast } = useToasts();

  const fetchConsents = useCallback(async () => {
    if (!connectedWallet) return;
    try {
      const contract = await getConsentRegistryContract(null);
      // For demo, we'll show how to interact with the contract
      // In a real app, we'd fetch from events
      const consentCount = await contract._consentIds();
      const count = Number(consentCount);
      const fetched: ConsentRecord[] = [];
      for (let i = 1; i <= count; i++) {
        try {
          const consent = await contract.getConsent(i);
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
        } catch {
          // Consent doesn't exist
        }
      }
      setConsents(fetched);
    } catch (e) {
      console.error('Failed to fetch consents:', e);
    }
  }, [connectedWallet]);

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
      const contract = await getConsentRegistryContract(null);
      // In demo mode, we create a mock consent record
      // In production, this would call contract.createConsent with actual data
      const newConsent: ConsentRecord = {
        consentId: String(consents.length + 1),
        participant: connectedWallet,
        cviAttestationHash: '0x' + Math.random().toString(16).slice(2, 66),
        receiptId: '0x' + Math.random().toString(16).slice(2, 66),
        studyId: 'Study-001',
        purposeHash: '0x' + Math.random().toString(16).slice(2, 66),
        policyVersion: 'v1.0',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        revokedAt: '',
        status: 'ACTIVE',
      };
      setConsents((prev) => [...prev, newConsent]);
      addToast('Consent created successfully!', 'success');
    } catch (e) {
      addToast('Failed to create consent', 'error');
    } finally {
      setCreating(false);
    }
  }, [connectedWallet, consents.length, addToast]);

  const handleRevokeConsent = useCallback(async (consentId: string) => {
    setRevoking(consentId);
    try {
      // In production, call contract.revokeConsent(consentId)
      setConsents((prev) =>
        prev.map((c) =>
          c.consentId === consentId ? { ...c, status: 'REVOKED', revokedAt: new Date().toISOString() } : c
        )
      );
      addToast('Consent revoked successfully', 'success');
    } catch (e) {
      addToast('Failed to revoke consent', 'error');
    } finally {
      setRevoking(null);
    }
  }, [addToast]);

  const handleConnected = useCallback((wallet: string) => {
    setConnectedWallet(wallet);
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
          <button
            onClick={handleCreateConsent}
            disabled={creating}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {creating ? '⏳ Creating...' : '✅'} Create Consent
          </button>
        </div>
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
