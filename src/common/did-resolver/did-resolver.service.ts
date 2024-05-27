import { Injectable } from '@nestjs/common';
import { DID_SERVICE_TYPE } from '../../constants';
import { getNetwork, isValidAddress } from '@ltonetwork/lto';
import { DIDDocument } from './did-document.type';
import { RequestService } from '../request/request.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DidResolverService {
  constructor(private readonly request: RequestService, private readonly config: ConfigService) {}

  async resolve(address: string): Promise<DIDDocument | null> {
    if (!isValidAddress(address, 'T') && !isValidAddress(address, 'L')) {
      throw new Error(`Invalid address ${address}`);
    }

    const url = this.config.getDidResolver(getNetwork(address) as 'L' | 'T');

    const response = await this.request.get<DIDDocument>(`${url}/${address}`);

    if (response.status === 404 && ((await response.data) as any).error === 'notFound') return null;
    if (response.status !== 200) throw new Error(`Failed to fetch DID document for ${address}`);

    const didDocument = response.data;
    if (didDocument['@context'] !== 'https://www.w3.org/ns/did/v1') {
      throw new Error(`Invalid DID document for ${address}`);
    }

    return didDocument;
  }

  async getServiceEndpoint(address: string): Promise<string> {
    const didDocument = await this.resolve(address);
    if (!didDocument) return this.config.getDefaultServiceEndpoint();

    const service = didDocument.service
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .find((s) => s.type === DID_SERVICE_TYPE);

    return service?.serviceEndpoint ?? this.config.getDefaultServiceEndpoint();
  }
}
