import { Injectable } from '@nestjs/common';
import { verifyTypedData } from 'ethers';
import { isValidAddress } from '../address/address.utils';

export interface SIWEMessage {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}

export interface SIWEAuthResult {
  isValid: boolean;
  address?: string;
  error?: string;
}

@Injectable()
export class SIWEService {
  private readonly domain: string;
  private readonly version: string = '1';

  constructor() {
    this.domain = process.env.SIWE_DOMAIN || 'localhost:8000';
  }

  /**
   * Verifies a SIWE message signature
   */
  async verifySIWEMessage(message: SIWEMessage, signature: string): Promise<SIWEAuthResult> {
    try {
      if (!signature || !signature.startsWith('0x')) {
        return { isValid: false, error: 'Invalid signature format' };
      }

      // Validate address format
      if (!isValidAddress(message.address)) {
        return { isValid: false, error: 'Invalid Ethereum address' };
      }

      // Define SIWE EIP-712 domain and types
      const domain = {
        name: 'Sign-In with Ethereum',
        version: this.version,
        chainId: message.chainId,
        verifyingContract: undefined, // SIWE doesn't use verifyingContract
      };

      const types = {
        Message: [
          { name: 'domain', type: 'string' },
          { name: 'address', type: 'address' },
          { name: 'statement', type: 'string' },
          { name: 'uri', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'nonce', type: 'string' },
          { name: 'issuedAt', type: 'string' },
          { name: 'expirationTime', type: 'string' },
          { name: 'notBefore', type: 'string' },
          { name: 'requestId', type: 'string' },
          { name: 'resources', type: 'string[]' },
        ],
      };

      // Create the message value for verification
      const value = {
        domain: message.domain,
        address: message.address,
        statement: message.statement || '',
        uri: message.uri,
        version: message.version,
        chainId: message.chainId,
        nonce: message.nonce,
        issuedAt: message.issuedAt,
        expirationTime: message.expirationTime || '',
        notBefore: message.notBefore || '',
        requestId: message.requestId || '',
        resources: message.resources || [],
      };

      // Verify the signature
      const recoveredAddress = await verifyTypedData(domain, types, value, signature);

      if (recoveredAddress.toLowerCase() !== message.address.toLowerCase()) {
        return {
          isValid: false,
          error: 'Signature does not match message address',
          address: recoveredAddress,
        };
      }

      // Check expiration if provided
      if (message.expirationTime) {
        const expirationTime = new Date(message.expirationTime);
        if (expirationTime < new Date()) {
          return { isValid: false, error: 'Message has expired' };
        }
      }

      // Check notBefore if provided
      if (message.notBefore) {
        const notBefore = new Date(message.notBefore);
        if (notBefore > new Date()) {
          return { isValid: false, error: 'Message is not yet valid' };
        }
      }

      return { isValid: true, address: recoveredAddress };
    } catch (error) {
      return {
        isValid: false,
        error: `SIWE verification failed: ${error.message}`,
      };
    }
  }

  /**
   * Generates a nonce for SIWE authentication
   */
  generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Creates a SIWE message template
   */
  createMessageTemplate(address: string, uri: string, chainId: number = 84532): Partial<SIWEMessage> {
    return {
      domain: this.domain,
      address,
      statement: 'Sign in with Ethereum to the EQTY Relay',
      uri,
      version: this.version,
      chainId,
      nonce: this.generateNonce(),
      issuedAt: new Date().toISOString(),
    };
  }
}
