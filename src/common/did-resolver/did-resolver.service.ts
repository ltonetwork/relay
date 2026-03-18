import { Injectable } from '@nestjs/common';
import { DID_SERVICE_TYPE } from '../../constants';
import { isValidAddress } from '../address/address.utils';
import { DIDDocument } from './did-document.type';
import { RequestService } from '../request/request.service';
import { ConfigService } from '../config/config.service';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class DidResolverService {
  constructor(
    private readonly request: RequestService,
    private readonly config: ConfigService,
    private readonly log: LoggerService,
  ) {}

  private isDidDocument(didDocument: any): didDocument is DIDDocument {
    return (
      didDocument &&
      (didDocument['@context'] === 'https://www.w3.org/ns/did/v1' ||
        (Array.isArray(didDocument['@context']) && didDocument['@context'].includes('https://www.w3.org/ns/did/v1'))) &&
      typeof didDocument.id === 'string'
    );
  }

  async resolve(address: string): Promise<DIDDocument | null> {
    if (!isValidAddress(address)) {
      throw new Error(`Invalid Ethereum address ${address}`);
    }

    // For now, return null as Ethereum DID resolution is not implemented
    // This service is primarily used for getting service endpoints
    // which will fall back to default service endpoint
    // TODO: Implement Ethereum DID resolver if needed
    return null;
  }

  async getServiceEndpoint(address: string): Promise<string> {
    try {
      if (!isValidAddress(address)) {
        throw new Error(`Invalid Ethereum address ${address}`);
      }

      // Try to resolve DID document (may return null for Ethereum addresses)
      const didDocument = await this.resolve(address);

      const service = didDocument?.service
        ?.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        ?.find((s) => s.type === DID_SERVICE_TYPE);

      return service?.serviceEndpoint ?? this.config.getDefaultServiceEndpoint();
    } catch (err) {
      this.log.warn((err as Error).message);
      return this.config.getDefaultServiceEndpoint();
    }
  }
}
