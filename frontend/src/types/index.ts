import { ConsentStatus as CS, RequestStatus as RS } from '../types/consent';

export type ConsentStatus = CS;
export type RequestStatus = RS;

export interface CviStatus {
  status: number;            // 1 = active, 2 = frozen/revoked
  tier: number;
  cvRecordId: number;
  txHash: string;
  countries?: string[];
}

export interface CcpVerification {
  code: number | string;     // 4 = pass, others = fail
  meaning: string;           // COMPLIANCE_FAILED, PASS, etc.
  allowed: boolean;          // true only when code === 4
  raw: Record<string, unknown>;
}

export interface ConsentRecord {
  consentId: string;
  participant: string;
  studyId: string;
  cviAttestationHash: string;
  receiptId: string;
  purposeHash: string;
  policyVersion: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string;
  status: ConsentStatus;
}

export interface AccessRequest {
  requestId: string;
  consentId: string;
  receiptId: string;
  researcher: string;
  studyId: string;
  purposeHash: string;
  queuedAt: string;
  expiresAt: string;
  compensation: string;
  status: RequestStatus;
  rejectionCode: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TxReceipt {
  hash: string;
  status: boolean;
  blockNumber: number;
  gasUsed: string;
}