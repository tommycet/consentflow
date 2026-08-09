import { useState, useEffect } from 'react';
import { getConsentRegistryContract, getProvider } from '../hooks/ethers';
import { StatusBadge } from '../components/StatusBadge';
import { shortHash } from '../hooks/useUtils';

interface AuditEntry {
  id: string;
  type: 'consent' | 'request';
  event: string;
  description: string;
  txHash: string;
  blockNumber: number;
  timestamp: string;
  status: string;
}

export function Audit() {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'consent' | 'request'>('all');

  useEffect(() => {
    loadAuditLog();
  }, []);

  const loadAuditLog = async () => {
    try {
      const contract = await getConsentRegistryContract(null);
      const provider = getProvider();
      const entries: AuditEntry[] = [];

      // In a real app, we'd query past events from the contract
      // For demo, we'll show a sample audit log
      const currentBlock = await provider.getBlockNumber();

      // Mock audit data for demo purposes
      entries.push(
        {
          id: '1',
          type: 'consent',
          event: 'ConsentCreated',
          description: 'Consent created for Study-001',
          txHash: '0x' + Math.random().toString(16).slice(2, 66),
          blockNumber: currentBlock - 100,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'ACTIVE',
        },
        {
          id: '2',
          type: 'request',
          event: 'AccessRequested',
          description: 'Access request queued for Study-001',
          txHash: '0x' + Math.random().toString(16).slice(2, 66),
          blockNumber: currentBlock - 50,
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          status: 'PENDING',
        }
      );

      setAuditLog(entries);
    } catch (e) {
      console.error('Failed to load audit log:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredLog = filter === 'all' ? auditLog : auditLog.filter((entry) => entry.type === filter);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Audit Log</h1>
        <p className="text-gray-400 mt-1">
          Complete event log of all consent and access request activities on-chain.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex bg-gray-900/50 rounded-lg p-1 border border-gray-800">
          {(['all', 'consent', 'request'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All Events' : f === 'consent' ? 'Consents' : 'Requests'}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500">{auditLog.length} total events</span>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Loading audit log...</p>
        </div>
      ) : filteredLog.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/40 border border-dashed border-gray-700 rounded-xl">
          <p className="text-gray-400">No audit events found.</p>
        </div>
      ) : (
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/80 border-b border-gray-800">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Block
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredLog.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{entry.event}</span>
                        <span className="text-xs text-gray-400">{entry.description}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        entry.type === 'consent'
                          ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700'
                          : 'bg-purple-900/50 text-purple-300 border border-purple-700'
                      }`}>
                        {entry.type === 'consent' ? 'Consent' : 'Request'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={entry.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      #{entry.blockNumber}
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={`https://testnet.monadexplorer.com/tx/${entry.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-emerald-400 hover:text-emerald-300"
                      >
                        {shortHash(entry.txHash)}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
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
