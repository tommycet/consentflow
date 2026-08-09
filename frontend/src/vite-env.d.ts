/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONSENT_REGISTRY_ADDRESS: string;
  readonly VITE_CONTRIBUTION_RECEIPT_ADDRESS: string;
  readonly VITE_API_URL: string;
  readonly VITE_MODE: string;
  readonly VITE_DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  chainId?: string;
  selectedAddress?: string;
}

interface Window {
  ethereum?: Eip1193Provider;
}