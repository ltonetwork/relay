export interface DIDDocument {
  '@context': string | string[];
  id: string;
  verificationMethod: VerificationMethod[];
  authentication?: Array<VerificationMethod | string>;
  assertionMethod?: Array<VerificationMethod | string>;
  keyAgreement?: Array<VerificationMethod | string>;
  capabilityDelegation?: Array<VerificationMethod | string>;
  capabilityInvocation?: Array<VerificationMethod | string>;
  service?: Service[];
}

interface VerificationMethod {
  id: string;
  type: string;
  publicKeyBase58: string;
}

interface Service {
  id: string;
  type: string;
  serviceEndpoint: string;
  priority?: number;
}
