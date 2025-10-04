import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { SignatureService } from '../signature/signature.service';
import { extractAddressFromPath, buildAddress } from '../address/address.utils';

@Injectable()
export class VerifySignatureMiddleware implements NestMiddleware {
  constructor(private readonly signatureService: SignatureService) {}

  async verifyRequest(req: Request, res: Response): Promise<boolean> {
    try {
      const path = req.path;
      const rawAddress = extractAddressFromPath(path);
      if (!rawAddress) {
        res.status(400).json({ message: 'No valid Ethereum address found in path' });
        return false;
      }

      // Validate and standardize the address
      const _walletAddress = buildAddress(rawAddress);

      // Verify the request signature using EIP-712
      const result = await this.signatureService.verifyRequestSignature(
        req.method,
        path,
        req.headers as Record<string, string>,
        req.body ? JSON.stringify(req.body) : undefined,
      );

      if (!result.isValid) {
        res.status(401).json({
          message: 'Signature verification failed',
          error: result.error,
        });
        return false;
      }

      // Set the signer information for downstream use
      req['signer'] = { address: result.address };
      return true;
    } catch (err) {
      res.status(401).json({
        message: 'Signature verification failed',
        error: err.message,
      });
      return false;
    }
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!(await this.verifyRequest(req, res))) return;
    next();
  }
}
