import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { SIWEService, SIWEMessage } from './siwe.service';

@Injectable()
export class SIWEAuthMiddleware implements NestMiddleware {
  constructor(private readonly siweService: SIWEService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract SIWE message and signature from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Parse the SIWE token (could be JWT or JSON)
      let siweData: { message: SIWEMessage; signature: string };
      try {
        siweData = JSON.parse(Buffer.from(token, 'base64').toString());
      } catch {
        throw new UnauthorizedException('Invalid token format');
      }

      // Verify the SIWE message
      const result = await this.siweService.verifySIWEMessage(siweData.message, siweData.signature);

      if (!result.isValid) {
        throw new UnauthorizedException(result.error || 'SIWE verification failed');
      }

      // Set the authenticated user information
      req['user'] = {
        address: result.address,
        siweMessage: siweData.message,
      };

      next();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(`Authentication failed: ${error.message}`);
    }
  }
}
