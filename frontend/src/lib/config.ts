// ConsentFlow frontend config — values come from Vite env vars (prefix: VITE_*)
// Copy to .env in production; for dev, set these inline.

import ConsentRegistryAbi from '../../generated/abis/ConsentRegistry.json';
import ContributionReceiptAbi from '../../generated/abis/ContributionReceipt.json';

export const CONFIG = {
  chainId: 10143,
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  chainName: 'Monad Testnet',
  contract: {
    consentRegistry:
      import.meta.env.VITE_CONSENT_REGISTRY_ADDRESS ||
      '0xE64495D37859cF5fC0629023146764D5c01208c0',
    contributionReceipt:
      import.meta.env.VITE_CONTRIBUTION_RECEIPT_ADDRESS ||
      '0x57EB95F57bBA38aABE9f29d26395BCA74Ab28c84',
  },
  // Real ABI arrays — ethers.Contract needs the parsed ABI, not a file path.
  abi: {
    ConsentRegistry: ConsentRegistryAbi,
    ContributionReceipt: ContributionReceiptAbi,
  },
  api: {
    baseUrl: '/api',
    backendPort: 4000,
  },
  atoken: '0xfa96de5b8f434c26fdff953303dd66ff80af1026',
};
