/**
 * # Stripe Checkout Controller
 *
 * Creates Stripe Checkout Sessions for authenticated users.
 *
 * ## Endpoint
 *
 * ```
 * POST /stripe/checkout  { planId: "..." }  →  { url: "https://checkout.stripe.com/..." }
 * ```
 *
 * The frontend redirects to the returned URL. Stripe handles the payment UI.
 * After payment, the user is redirected back to our success/cancel page.
 */
import {
  Body,
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
import { createCheckoutSchema } from '@paisa/shared';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { StripeCheckoutService } from '../services/stripe-checkout.service';
import type { AuthUser } from '@paisa/shared';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeCheckoutController {
  constructor(
    private readonly checkoutService: StripeCheckoutService,
  ) {}

  /**
   * Create a Stripe Checkout Session.
   *
   * Returns a URL that the frontend should redirect to.
   * Works for both one-time payments and subscriptions —
   * determined automatically by the plan's interval.
   */
  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a checkout session' })
  @ApiResponse({ status: 200, description: 'Returns Stripe Checkout URL' })
  @ApiResponse({ status: 404, description: 'Plan not found or inactive' })
  @ApiResponse({ status: 409, description: 'Already subscribed to this product' })
  async createCheckout(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCheckoutSchema))
    body: { planId: string },
  ) {
    return this.checkoutService.createCheckoutSession(
      user.id,
      user.email,
      user.name,
      body.planId,
    );
  }
}
