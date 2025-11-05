import { Injectable } from '@nestjs/common';
import { DID_SERVICE_TYPE } from '../../constants';
import { getNetwork, isValidAddress } from '@ltonetwork/lto';
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
    if (!isValidAddress(address, 'T') && !isValidAddress(address, 'L')) {
      throw new Error(`Invalid address ${address}`);
    }

    const url = this.config.getDidResolver(getNetwork(address) as 'L' | 'T');

    const response = await this.request.get<DIDDocument>(`${url}/${address}`);

    if (response.status === 404 && ((await response.data) as any).error === 'notFound') return null;
    if (response.status !== 200) throw new Error(`Failed to fetch DID document for ${address}`);

    const didDocument = response.data;
    if (!this.isDidDocument(didDocument)) {
      throw new Error(`Invalid DID document for ${address}`);
    }

    return didDocument;
  }

  async getServiceEndpoint(address: string): Promise<string> {
    try {
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
