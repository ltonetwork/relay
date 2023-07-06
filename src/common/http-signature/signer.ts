import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface PublicKey {
  keyType: string;
  publicKey: string;
}

export const Signer = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request['signer'];
});
