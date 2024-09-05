import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { LTO } from '@ltonetwork/lto';
import { verify } from '@ltonetwork/http-message-signatures';
import { ConfigService } from '../config/config.service';

@Injectable()
export class VerifySignatureMiddleware implements NestMiddleware {
  private readonly lto: LTO;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    const { networkID, host, port, apiPrefix } = {
      networkID: this.config.getNetworkId(),
      host: this.config.getHostname(),
      port: this.config.getPort(),
      apiPrefix: this.config.getApiPrefix(),
    };
    this.lto = new LTO('T');
    const base = host === 'http://localhost' ? `${host}:${port}` : host;
    this.baseUrl = apiPrefix ? `${base}${apiPrefix}` : base;
  }

  async transformRequest(req: Request, baseUrl: string) {
    const signature = req.headers['signature'];
    const signatureInput = req.headers['signature-input'];

    if (!signature || !signatureInput) {
      throw new Error('Missing required signature headers');
    }

    return {
      method: req.method,
      url: baseUrl,
      headers: {
        signature: signature,
        'signature-input': signatureInput,
      },
    };
  }

  async verify(req: Request, res: Response): Promise<boolean> {
    try {
      // console.log(res);
      // const url = `${this.baseUrl}${req.path}`;
      // const signedRequest = await this.transformRequest(req, url);
      const account = await verify(req, this.lto);
      req['signer'] = account;
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
