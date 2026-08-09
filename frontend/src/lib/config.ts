// ConsentFlow frontend config — values come from Vite env vars (prefix: VITE_*)
// Copy to .env in production; for dev, set these inline.

export const CONFIG = {
  chainId: 10143,
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  chainName: 'Monad Testnet',
  contract: {
    consentRegistry: import.meta.env.VITE_CONSENT_REGISTRY_ADDRESS || '0x',
    contributionReceipt: import.meta.env.VITE_CONTRIBUTION_RECEIPT_ADDRESS || '0x',
  },
  // Contract abi paths — relative to the frontend root
  abi: {
    ConsentRegistry: 'generated/abis/ConsentRegistry.json',
    ContributionReceipt: 'generated/abis/ContributionReceipt.json',
  },
  api: {
    baseUrl: '/api',
    backendPort: 4000,
  },
  atoken: '0xfa96de5b8f434c26fdff953303dd66ff80af1026',
};
