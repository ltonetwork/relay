import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '../common/config/config.service';
import { isValidAddress } from '../common/address/address.utils';

@Injectable()
export class InboxGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.disableAuth()) return true;

    const request = context.switchToHttp().getRequest();

    if (!request.signer || !request.signer.address) {
      throw new UnauthorizedException('Request not signed');
    }

    // Extract address from path parameters
    const addressParam = request.params.address;
    if (!addressParam) {
      throw new UnauthorizedException('No address parameter found');
    }

    // Validate the address format
    if (!isValidAddress(addressParam)) {
      throw new UnauthorizedException('Invalid address format');
    }

    // Verify the authenticated signer matches the requested address
    // The HTTP signature middleware already verified the signature,
    // so we just need to check that the signer's address matches the requested address
    const signerAddress = request.signer.address.toLowerCase();
    const requestedAddress = addressParam.toLowerCase();

    if (signerAddress !== requestedAddress) {
      throw new UnauthorizedException('Address mismatch: signer does not match requested address');
    }

    return true;
  }
}
