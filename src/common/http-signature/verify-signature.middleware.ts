import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { LTO, getNetwork } from '@ltonetwork/lto';
import { verify } from '@ltonetwork/http-message-signatures';

export const lto = new LTO();
@Injectable()
export class VerifySignatureMiddleware implements NestMiddleware {
  private lto: LTO;

  constructor() {
    this.lto = new LTO();
  }

  async verifyRequest(req: Request, res: Response): Promise<boolean> {
    try {
      const path = req.path;
      const walletAddress = path.match(/3[^\/]*/)?.[0];
      const network = getNetwork(walletAddress);

      //switch to testnet if address is testnet
      if (network == 'T') this.lto = new LTO(network);

      const account = await verify(req, this.lto);
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
