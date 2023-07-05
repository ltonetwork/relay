import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { LTO } from '@ltonetwork/lto';
import { verify } from '@ltonetwork/http-message-signatures';

@Injectable()
export class VerifySignatureMiddleware implements NestMiddleware {
  constructor(private readonly lto: LTO) {}

  async verify(req: Request, res: Response): Promise<boolean> {
    try {
      req['signer'] = await verify(req, this.lto);
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
