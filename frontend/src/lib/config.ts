// ConsentFlow frontend config — values come from Vite env vars (prefix: VITE_*)
// Copy to .env in production; for dev, set these inline.

export const CONFIG = {
  chainId: 10143,
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  chainName: 'Monad Testnet',
  contract: {
    consentRegistry: import.meta.env.VITE_CONSENT_REGISTRY_ADDRESS || '0x',
    contributionReceipt: import.meta.env.VITE_CONTIBUTION_RECEIPT_ADDRESS || '0x',
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
  wallet: {
    demoAddresses: {
      participant: '0xA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0',
      researcher: '0xB2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2',
    },
  },
  demo: {
    enable: true,
    fakeCvi: {
      txHash: '0x9728159cda447d22ee260412f1f9abb587720a2bab6e1b91b337c0e54124d',
      cvRecordId: 594,
      tier: 50,
    },
  },
  atoken: '0xfa96de5b8f434c26fdff953303dd66ff80af1026',
};
