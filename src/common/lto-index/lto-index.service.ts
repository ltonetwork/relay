import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { Binary } from '@ltonetwork/lto';
import { RequestService } from '../request/request.service';

@Injectable()
export class LtoIndexService {
  constructor(private config: ConfigService, private request: RequestService) {}

  async verifyAnchor(networkId: 'L' | 'T', hash: Binary): Promise<boolean> {
    const url = this.config.getLTONode(networkId) + `/index/hash/${hash.hex}/encoding/hex`;
    const response = await this.request.get(url);

    if (response.status !== 200 && response.status !== 404) {
      throw new Error(`lto-index: error verifying anchor on ${url}`);
    }

    return response.status === 200;
  }
}
