import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class SIWEGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (!request.user || !request.user.address) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Extract address from path parameters
    const addressParam = request.params.address || request.params.recipient;
    if (!addressParam) {
      throw new UnauthorizedException('No address parameter found');
    }

    // Verify the authenticated user matches the requested address
    const authenticatedAddress = request.user.address.toLowerCase();
    const requestedAddress = addressParam.toLowerCase();

    if (authenticatedAddress !== requestedAddress) {
      throw new UnauthorizedException('Address mismatch: authenticated user does not match requested address');
    }

    return true;
  }
}
