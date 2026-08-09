import type { ConsentRecord } from '../types';
import { StatusBadge } from './StatusBadge';
import { truncateAddress } from '../hooks/useUtils';

/**
 * Contract timestamps are uint64 UNIX *seconds*; `new Date(seconds)` treats the
 * value as milliseconds and renders "Invalid Date" / 1970-era dates. Multiply by
 * 1000, and treat 0 as "unset" (the revokedAt sentinel) rather than epoch 0.
 */
function formatChainTime(value: string | number | bigint | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toLocaleString();
}

interface ConsentCardProps {
  consent: ConsentRecord;
  onRevoke?: (consentId: string) => void;
  canRevoke?: boolean;
}

export function ConsentCard({ consent, onRevoke, canRevoke = true }: ConsentCardProps) {
  const createdAt = formatChainTime(consent.createdAt);
  const expiresAt = formatChainTime(consent.expiresAt);
  const revokedAt = formatChainTime(consent.revokedAt);
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-gray-300">Consent #{consent.consentId}</span>
            <StatusBadge status={consent.status} />
          </div>
          <p className="text-xs text-gray-500">Study: {consent.studyId}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 w-24">Participant:</span>
          <span className="font-mono text-gray-300">{truncateAddress(consent.participant)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 w-24">Receipt:</span>
          <span className="font-mono text-gray-300">{truncateAddress(consent.receiptId)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 w-24">CVI Hash:</span>
          <span className="font-mono text-gray-300 text-xs">{truncateAddress(consent.cviAttestationHash)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 w-24">Policy:</span>
          <span className="text-gray-300">{consent.policyVersion}</span>
        </div>
        {createdAt && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 w-24">Created:</span>
            <span className="text-gray-300">{createdAt}</span>
          </div>
        )}
        {expiresAt && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 w-24">Expires:</span>
            <span className="text-gray-300">{expiresAt}</span>
          </div>
        )}
        {revokedAt && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 w-24">Revoked:</span>
            <span className="text-red-300">{revokedAt}</span>
          </div>
        )}
      </div>

      {canRevoke && consent.status === 'ACTIVE' && (
        <button
          onClick={() => onRevoke?.(consent.consentId)}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Revoke Consent
        </button>
      )}
    </div>
  );
}
