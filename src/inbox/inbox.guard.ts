import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { getNetwork, LTO } from '@ltonetwork/lto';
import { ConfigService } from '../common/config/config.service';
import { PublicKey } from '../common/http-signature/signer';

@Injectable()
export class InboxGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  private isAuthorized(signer: PublicKey, address: string): boolean {
    const networkId = getNetwork(signer.publicKey);
    const account = new LTO(networkId).account(signer);

    return account.address === address;
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.config.disableAuth()) return true;

    const request = context.switchToHttp().getRequest();
    if (!request.signer) throw new UnauthorizedException();

    return this.isAuthorized(request.signer, request.params.address);
  }
}
