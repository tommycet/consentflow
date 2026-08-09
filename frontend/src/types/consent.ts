export type ConsentStatus = 'NONE' | 'ACTIVE' | 'REVOKED';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type RejectionCode =
  | 'NONE'
  | 'CVI_REVOKED'
  | 'CVA_REVOKED'
  | 'EXPIRED'
  | 'PURPOSE_MISMATCH'
  | 'STUDY_MISMATCH'
  | 'POLICY_UNSUPPORTED';

export interface ConsentStruct {
  consentId: string;
  participant: string;
  cviAttestationHash: string;
  receiptId: string;
  studyId: string;
  purposeHash: string;
  policyVersion: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string;
  status: ConsentStatus;
}

export interface AccessRequestStruct {
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
  rejectionCode: RejectionCode;
}

// ConsentStatus enum mapping (solidity: NONE=0, ACTIVE=1, REVOKED=2)
export const ConsentStatusMap: Record<number, ConsentStatus> = {
  0: 'NONE',
  1: 'ACTIVE',
  2: 'REVOKED',
};

// RequestStatus enum mapping (solidity: PENDING=0, APPROVED=1, REJECTED=2)
export const RequestStatusMap: Record<number, RequestStatus> = {
  0: 'PENDING',
  1: 'APPROVED',
  2: 'REJECTED',
};

// RejectionCode enum mapping
export const RejectionCodeMap: Record<number, RejectionCode> = {
  0: 'NONE',
  1: 'CVI_REVOKED',
  2: 'CVA_REVOKED',
  3: 'EXPIRED',
  4: 'PURPOSE_MISMATCH',
  5: 'STUDY_MISMATCH',
  6: 'POLICY_UNSUPPORTED',
};
