import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { LTO } from '@ltonetwork/lto';
import { verify } from '@ltonetwork/http-message-signatures';
import { ConfigService } from '../config/config.service';

@Injectable()
export class VerifySignatureMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  private networkId(req: Request): 'L' | 'T' | undefined {
    const network = req.headers['lto-network']?.toString().toLowerCase() ?? this.config.getDefaultNetwork();

    if (network === 'mainnet' || network === 'L') return 'L';
    if (network === 'testnet' || network === 'T') return 'T';
  }

  async verify(req: Request, res: Response): Promise<boolean> {
    const networkId = this.networkId(req);
    if (!networkId) {
      res.status(400).json({ message: 'Invalid value for LTO-Network header' });
      return false;
    }

    const lto = new LTO(networkId);

    try {
      req['signer'] = await verify(req, lto);
    } catch (err) {
      res.status(401).json({ message: 'Signature verification failed', error: err.message });
      return false;
    }

    return true;
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if ('signature' in req.headers && !(await this.verify(req, res))) return;
    next();
  }
}
