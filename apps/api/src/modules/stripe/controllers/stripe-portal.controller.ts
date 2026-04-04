/**
 * # Stripe Portal Controller
 *
 * Creates Stripe Billing Portal sessions for self-service billing.
 *
 * ## Endpoint
 *
 * ```
 * POST /stripe/portal  →  { url: "https://billing.stripe.com/..." }
 * ```
 *
 * The frontend redirects to the returned URL.
 * When the customer is done, Stripe redirects them back to /billing.
 */
import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { StripePortalService } from '../services/stripe-portal.service';
import type { AuthUser } from '@paisa/shared';

@ApiTags('Stripe')
@Controller('stripe')
export class StripePortalController {
  constructor(
    private readonly portalService: StripePortalService,
  ) {}

  /**
   * Create a Stripe Billing Portal session.
   *
   * Returns a URL that the frontend should redirect to.
   * The portal lets the user manage payment methods, view invoices,
   * and cancel/change subscriptions.
   */
  @Post('portal')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open the billing portal' })
  @ApiResponse({ status: 200, description: 'Returns Stripe Billing Portal URL' })
  @ApiResponse({ status: 404, description: 'No billing account found' })
  async createPortalSession(@CurrentUser() user: AuthUser) {
    return this.portalService.createPortalSession(user.id);
  }
}
