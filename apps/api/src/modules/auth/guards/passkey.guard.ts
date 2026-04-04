/**
 * # Passkey Feature Guard
 *
 * Checks the FEATURE_AUTH_PASSKEY_ENABLED flag before allowing access
 * to passkey endpoints. Returns 404 when passkeys are disabled —
 * making the endpoints invisible from the client's perspective.
 *
 * Applied at the controller level to gate ALL passkey endpoints.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../../../core/config/config.service';

@Injectable()
export class PasskeyGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.config.features.auth.passkey.enabled) {
      throw new NotFoundException(
        'Passkey authentication is not enabled.',
      );
    }

    return true;
  }
}
