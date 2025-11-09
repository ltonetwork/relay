import { Controller, Post, Body, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SIWEService, SIWEMessage } from './siwe.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly siweService: SIWEService) {}

  @Post('nonce')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a nonce for SIWE authentication' })
  @ApiResponse({ status: 200, description: 'Nonce generated successfully' })
  async getNonce(@Res() res: Response): Promise<Response> {
    const nonce = this.siweService.generateNonce();
    return res.json({ nonce });
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify SIWE message and return authentication token' })
  @ApiBody({
    description: 'SIWE message and signature',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            address: { type: 'string' },
            statement: { type: 'string' },
            uri: { type: 'string' },
            version: { type: 'string' },
            chainId: { type: 'number' },
            nonce: { type: 'string' },
            issuedAt: { type: 'string' },
            expirationTime: { type: 'string' },
            notBefore: { type: 'string' },
            requestId: { type: 'string' },
            resources: { type: 'array', items: { type: 'string' } },
          },
        },
        signature: { type: 'string' },
      },
      required: ['message', 'signature'],
    },
  })
  @ApiResponse({ status: 200, description: 'SIWE message verified successfully' })
  @ApiResponse({ status: 401, description: 'SIWE verification failed' })
  async verifySIWE(@Body() body: { message: SIWEMessage; signature: string }, @Res() res: Response): Promise<Response> {
    try {
      const result = await this.siweService.verifySIWEMessage(body.message, body.signature);

      if (!result.isValid) {
        return res.status(401).json({
          error: result.error || 'SIWE verification failed',
        });
      }

      // Create a simple token (in production, use proper JWT)
      const token = Buffer.from(
        JSON.stringify({
          message: body.message,
          signature: body.signature,
        }),
      ).toString('base64');

      return res.json({
        success: true,
        address: result.address,
        token,
        expiresIn: '24h', // Token expires in 24 hours
      });
    } catch (error) {
      return res.status(401).json({
        error: `SIWE verification failed: ${error.message}`,
      });
    }
  }
}
