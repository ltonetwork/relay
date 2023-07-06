import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { LTO } from '@ltonetwork/lto';
import { verify } from '@ltonetwork/http-message-signatures';

@Injectable()
export class VerifySignatureMiddleware implements NestMiddleware {
  private readonly lto: LTO;

  constructor() {
    this.lto = new LTO();
  }

  async verify(req: Request, res: Response): Promise<boolean> {
    try {
      const account = await verify(req, this.lto);
      req['signer'] = { keyType: account.keyType, publicKey: account.publicKey };
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
