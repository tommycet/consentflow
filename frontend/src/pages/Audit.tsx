import { useState, useEffect } from 'react';
import { getConsentRegistryContract } from '../hooks/ethers';
import { CONFIG } from '../lib/config';
import { StatusBadge } from '../components/StatusBadge';
import { shortHash } from '../hooks/useUtils';
import { IconHash } from '../components/Icons';

const EXPLORER = 'https://testnet.monadexplorer.com';

interface AuditEntry {
  id: string;
  type: 'consent' | 'request';
  event: string;
  description: string;
  /** Present only when a real event log was found in the recent-block window. */
  txHash: string | null;
  blockNumber: number | null;
  /** UNIX seconds from the contract. */
  timestamp: number;
  status: string;
}

/** Monad's RPC rejects eth_getLogs ranges wider than 100 blocks. */
const LOG_WINDOW = 100;
const WINDOWS_TO_SCAN = 5;

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  return new Date(seconds * 1000).toLocaleString();
}

export function Audit() {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'consent' | 'request'>('all');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const contract = await getConsentRegistryContract(null);

        // ── Authoritative source: contract state ──────────────────────
        // Reading state (not logs) is reliable on Monad and cannot go stale
        // behind a log-range limit. Every row below is real chain data.
        const [consentCount, requestCount] = await Promise.all([
          contract._consentIds(),
          contract._requestIds(),
        ]);

        const entries: AuditEntry[] = [];

        for (let i = 1; i <= Number(consentCount); i++) {
          try {
            const c = await contract.getConsent(i);
            const status = Number(c.status);
            const revokedAt = Number(c.revokedAt);
            entries.push({
              id: `consent-${i}`,
              type: 'consent',
              event: revokedAt > 0 ? 'ConsentRevoked' : 'ConsentCreated',
              description: `Consent #${i} · study ${shortHash(c.studyId)}`,
              txHash: null,
              blockNumber: null,
              timestamp: revokedAt > 0 ? revokedAt : Number(c.createdAt),
              status: status === 1 ? 'ACTIVE' : status === 2 ? 'REVOKED' : 'NONE',
            });
          } catch {
            // id gap — skip
          }
        }

        for (let i = 1; i <= Number(requestCount); i++) {
          try {
            const r = await contract.getAccessRequest(i);
            const status = Number(r.status);
            entries.push({
              id: `request-${i}`,
              type: 'request',
              event:
                status === 1 ? 'AccessApproved' : status === 2 ? 'AccessRejected' : 'AccessRequested',
              description: `Request #${i} · consent #${r.consentId} · ${
                Number(r.compensation) / 1e18
              } MON`,
              txHash: null,
              blockNumber: null,
              timestamp: Number(r.queuedAt),
              status: status === 0 ? 'PENDING' : status === 1 ? 'APPROVED' : 'REJECTED',
            });
          } catch {
            // id gap — skip
          }
        }

        // ── Enrichment: attach real tx hashes for recent events ───────
        // Best-effort only. Monad caps eth_getLogs at 100 blocks, so we scan a
        // few recent windows; older entries simply keep txHash = null rather
        // than displaying a fabricated hash.
        try {
          const provider = contract.runner?.provider;
          if (provider) {
            const head = await provider.getBlockNumber();
            for (let w = 0; w < WINDOWS_TO_SCAN; w++) {
              const to = head - w * LOG_WINDOW;
              const from = to - (LOG_WINDOW - 1);
              for (const name of ['ConsentCreated', 'ConsentRevoked', 'AccessRequested']) {
                try {
                  const logs = await contract.queryFilter(name, from, to);
                  for (const log of logs) {
                    const id = Number((log as any).args?.[0] ?? 0);
                    const key =
                      name === 'AccessRequested' ? `request-${id}` : `consent-${id}`;
                    const hit = entries.find((e) => e.id === key);
                    if (hit) {
                      hit.txHash = log.transactionHash;
                      hit.blockNumber = log.blockNumber;
                    }
                  }
                } catch {
                  // window/event unsupported — keep going
                }
              }
            }
          }
        } catch {
          // enrichment is optional
        }

        entries.sort((a, b) => b.timestamp - a.timestamp);
        if (!cancelled) setAuditLog(entries);
      } catch (e: any) {
        if (!cancelled) setError(e?.shortMessage || e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLog = filter === 'all' ? auditLog : auditLog.filter((e) => e.type === filter);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-semibold text-white">Audit Log</h1>
        <p className="text-cf-textMuted mt-1">
          Consent and access-request state read directly from ConsentRegistry on Monad testnet.
        </p>
        <a
          href={`${EXPLORER}/address/${CONFIG.contract.consentRegistry}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-xs font-mono text-cf-teal hover:text-cf-tealDim"
        >
          {CONFIG.contract.consentRegistry} ↗
        </a>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex bg-cf-surface rounded-lg p-1 border border-cf-border">
          {(['all', 'consent', 'request'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-cf-teal/20 text-cf-teal border border-cf-teal/30'
                  : 'text-cf-textMuted hover:text-white'
              }`}
            >
              {f === 'all' ? 'All Events' : f === 'consent' ? 'Consents' : 'Requests'}
            </button>
          ))}
        </div>
        <span className="text-sm text-cf-textDim">{auditLog.length} on-chain records</span>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-cf-textMuted">Reading ConsentRegistry state…</p>
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-cf-surface/40 border border-dashed border-red-900 rounded-xl">
          <p className="text-red-300 text-sm">Failed to read chain: {error}</p>
        </div>
      ) : filteredLog.length === 0 ? (
        <div className="text-center py-12 bg-cf-surface/40 border border-dashed border-cf-border rounded-xl">
          <p className="text-cf-textMuted">No on-chain records yet.</p>
        </div>
      ) : (
        <div className="cf-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-cf-surface/80 border-b border-cf-border">
                  {['Event', 'Type', 'Status', 'Block', 'Transaction', 'Timestamp'].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-4 text-left text-xs font-semibold text-cf-textMuted uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-cf-border">
                {filteredLog.map((entry) => (
                  <tr key={entry.id} className="hover:bg-cf-panelHover transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <IconHash className="w-4 h-4 text-cf-teal/60" />
                        <span className="text-sm font-medium text-white">{entry.event}</span>
                        <span className="text-xs text-cf-textMuted">{entry.description}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.type === 'consent'
                            ? 'bg-cf-teal/10 text-cf-teal border border-cf-teal/30'
                            : 'bg-cf-purple/10 text-cf-purple border border-cf-purple/30'
                        }`}
                      >
                        {entry.type === 'consent' ? 'Consent' : 'Request'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={entry.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-sm text-cf-textMuted">
                      {entry.blockNumber ? `#${entry.blockNumber}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {entry.txHash ? (
                        <a
                          href={`${EXPLORER}/tx/${entry.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-cf-teal hover:text-cf-tealDim"
                        >
                          {shortHash(entry.txHash)}
                        </a>
                      ) : (
                        <span className="text-xs text-cf-textDim" title="Outside the 100-block log window">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-cf-textMuted">{fmt(entry.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
