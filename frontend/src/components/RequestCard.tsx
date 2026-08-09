import type { AccessRequest } from '../types';
import { StatusBadge } from './StatusBadge';
import { truncateAddress } from '../hooks/useUtils';

interface RequestCardProps {
  request: AccessRequest;
  onSettle?: (requestId: string) => void;
  canSettle?: boolean;
}

export function RequestCard({ request, onSettle, canSettle = true }: RequestCardProps) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-gray-300">Request #{request.requestId}</span>
            <StatusBadge status={request.status} />
          </div>
          <p className="text-xs text-gray-500">Study: {request.studyId}</p>
        </div>
        <span className="text-lg font-semibold text-emerald-400">
          {request.compensation} ETH
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 w-28">Researcher:</span>
          <span className="font-mono text-gray-300">{truncateAddress(request.researcher)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 w-28">Receipt:</span>
          <span className="font-mono text-gray-300">{truncateAddress(request.receiptId)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 w-28">Consent ID:</span>
          <span className="font-mono text-gray-300">#{request.consentId}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 w-28">Queued:</span>
          <span className="text-gray-300">{new Date(request.queuedAt).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 w-28">Expires:</span>
          <span className="text-gray-300">{new Date(request.expiresAt).toLocaleString()}</span>
        </div>
      </div>

      {canSettle && request.status === 'PENDING' && (
        <button
          onClick={() => onSettle?.(request.requestId)}
          className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Settle Request
        </button>
      )}
    </div>
  );
}
