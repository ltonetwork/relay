import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { LTO, getNetwork } from '@ltonetwork/lto';
import { verify } from '@ltonetwork/http-message-signatures';

@Injectable()
export class VerifySignatureMiddleware implements NestMiddleware {
  async verifyRequest(req: Request, res: Response): Promise<boolean> {
    try {
      const path = req.path;
      const walletAddress = path.match(/3[^\/]*/)?.[0];
      const network = getNetwork(walletAddress);
      const lto = new LTO(network);
      const account = await verify(req, lto);
      req['signer'] = account;
    } catch (err) {
      res.status(401).json({ message: 'Signature verification failed', error: err.message });
      return false;
    }
    return true;
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!(await this.verifyRequest(req, res))) return;
    next();
  }
}
