import { Injectable } from '@nestjs/common';
import { verifyTypedData } from 'ethers';
import { isValidAddress, extractAddressFromPath, buildAddress } from '../address/address.utils';
import * as crypto from 'crypto';

export interface SignatureVerificationResult {
  isValid: boolean;
  address?: string;
  error?: string;
}

/**
 * EIP-712 Typed Data Domain interface
 * Compatible with eqty-core's ITypedDataDomain
 */
export interface TypedDataDomain {
  name?: string;
  version?: string;
  chainId?: number;
}

/**
 * EIP-712 Typed Data Field interface
 * Compatible with eqty-core's ITypedDataField
 */
export interface TypedDataField {
  name: string;
  type: string;
}

@Injectable()
export class SignatureService {
  /**
   * Verifies EIP-712 typed data signature
   */
  async verifyTypedDataSignature(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, any>,
    signature: string,
    expectedAddress?: string,
  ): Promise<SignatureVerificationResult> {
    try {
      if (!signature || !signature.startsWith('0x')) {
        return { isValid: false, error: 'Invalid signature format' };
      }

      const recoveredAddress = await verifyTypedData(domain, types, value, signature);

      if (expectedAddress && recoveredAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
        return {
          isValid: false,
          error: 'Signature does not match expected address',
          address: recoveredAddress,
        };
      }

      return { isValid: true, address: recoveredAddress };
    } catch (error) {
      return {
        isValid: false,
        error: `Signature verification failed: ${error.message}`,
      };
    }
  }

  /**
   * Verifies HTTP request signature for inbox access
   */
  async verifyRequestSignature(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: string,
  ): Promise<SignatureVerificationResult> {
    try {
      const rawAddress = extractAddressFromPath(path);
      if (!rawAddress) {
        return { isValid: false, error: 'No address found in path' };
      }

      // Validate and standardize the address
      const address = buildAddress(rawAddress);

      const signature = headers['authorization']?.replace('Bearer ', '');
      if (!signature) {
        return { isValid: false, error: 'No signature provided' };
      }

      // Create the message to sign (HTTP request details)
      const _message = this.createRequestMessage(method, path, headers, body);

      // Define the EIP-712 domain and types for HTTP request signing
      const domain: TypedDataDomain = {
        name: 'EQTY-Relay',
        version: '1',
        chainId: 8453, // Base mainnet
      };

      const types: Record<string, TypedDataField[]> = {
        Request: [
          { name: 'method', type: 'string' },
          { name: 'path', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'bodyHash', type: 'bytes32' },
        ],
      };

      const value = {
        method,
        path,
        timestamp: parseInt(headers['x-timestamp'] || '0'),
        bodyHash: body ? this.hashBody(body) : '0x0000000000000000000000000000000000000000000000000000000000000000',
      };

      return await this.verifyTypedDataSignature(domain, types, value, signature, address);
    } catch (error) {
      return {
        isValid: false,
        error: `Request signature verification failed: ${error.message}`,
      };
    }
  }

  /**
   * Creates a standardized message for HTTP request signing
   */
  private createRequestMessage(method: string, path: string, headers: Record<string, string>, body?: string): string {
    const timestamp = headers['x-timestamp'] || Date.now().toString();
    const bodyHash = body ? this.hashBody(body) : '0x0000000000000000000000000000000000000000000000000000000000000000';

    return `${method} ${path}\nTimestamp: ${timestamp}\nBodyHash: ${bodyHash}`;
  }

  /**
   * Hashes the request body using keccak256
   */
  private hashBody(body: string): string {
    // Simple hash implementation - in production, use proper keccak256
    const hash = crypto.createHash('sha256').update(body).digest('hex');
    return `0x${hash}`;
  }

  /**
   * Validates if an address is properly formatted
   */
  validateAddress(address: string): boolean {
    return isValidAddress(address);
  }
}
