// Contract ABI references and config re-exports.
// ABIs are copied from Foundry `out/` directory after `forge build`.
// generated/ is at the project root (frontend/generated/abis/)

import ConsentRegistryABIJson from '../../generated/abis/ConsentRegistry.json';
import ContributionReceiptABIJson from '../../generated/abis/ContributionReceipt.json';

export const ConsentRegistryABI = ConsentRegistryABIJson;
export const ContributionReceiptABI = ContributionReceiptABIJson;

export { CONFIG } from './config';
export type { ConsentStruct as Consent, AccessRequestStruct as AccessRequest } from '../types/consent';
export type { ConsentStatus, RequestStatus, RejectionCode } from '../types/consent';
