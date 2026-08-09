import type { ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  details?: string;
}

const variantConfig = {
  success: {
    bg: 'bg-emerald-900/90',
    border: 'border-emerald-500/30',
    icon: '✅',
    text: 'text-emerald-100',
    detail: 'text-emerald-300/70',
  },
  error: {
    bg: 'bg-red-900/90',
    border: 'border-red-500/30',
    icon: '❌',
    text: 'text-red-100',
    detail: 'text-red-300/70',
  },
  info: {
    bg: 'bg-blue-900/90',
    border: 'border-blue-500/30',
    icon: 'ℹ️',
    text: 'text-blue-100',
    detail: 'text-blue-300/70',
  },
  warning: {
    bg: 'bg-yellow-900/90',
    border: 'border-yellow-500/30',
    icon: '⚠️',
    text: 'text-yellow-100',
    detail: 'text-yellow-300/70',
  },
};

export function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const config = variantConfig[toast.variant];

  return (
    <div
      className={`${config.bg} ${config.border} border rounded-lg p-4 shadow-xl backdrop-blur-sm min-w-[320px] max-w-md animate-[slideIn_0.3s_ease-out]`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${config.text}`}>{toast.message}</p>
          {toast.details && (
            <p className={`text-xs mt-1 ${config.detail}`}>{toast.details}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}