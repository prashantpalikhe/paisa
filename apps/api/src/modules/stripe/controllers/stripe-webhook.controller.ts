/**
 * # Stripe Webhook Controller
 *
 * Receives and verifies webhook events from Stripe.
 *
 * ## How Stripe webhooks work
 *
 * 1. Something happens in Stripe (payment succeeds, subscription changes, etc.)
 * 2. Stripe POSTs a JSON event to this endpoint
 * 3. We verify the signature to ensure it's really from Stripe (not forged)
 * 4. We process the event and update our database
 * 5. We return 200 to acknowledge receipt
 *
 * ## Signature verification
 *
 * Stripe signs every webhook with your webhook secret (whsec_xxx).
 * The signature is in the `stripe-signature` HTTP header.
 * `stripe.webhooks.constructEvent()` verifies it using the raw request body.
 *
 * CRITICAL: The raw body (Buffer) is required — not the parsed JSON object.
 * Express's JSON middleware parses the body before it reaches us, destroying
 * the original bytes. We solve this by storing the raw body via middleware
 * in configure-app.ts (see rawBodyMiddleware).
 *
 * ## Why @Public()?
 *
 * This endpoint is called by Stripe's servers, not by authenticated users.
 * Stripe authenticates via webhook signatures instead of JWT.
 */
import {
  Controller,
  Post,
  Req,
  Inject,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import type { Stripe } from '../stripe-types';
import { STRIPE_CLIENT } from '../stripe.constants';
import { StripeWebhookService } from '../services/stripe-webhook.service';
import { AppConfigService } from '../../../core/config/config.service';
import { Public } from '../../../common/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly webhookService: StripeWebhookService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * POST /stripe/webhooks
   *
   * Receives webhook events from Stripe.
   * Returns 200 immediately — heavy processing is best-effort.
   *
   * The endpoint is excluded from Swagger docs because it is
   * only called by Stripe, not by frontend developers.
   */
  @Public()
  @SkipThrottle()
  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Stripe webhook endpoint (called by Stripe)' })
  async handleWebhook(@Req() req: Request): Promise<{ received: true }> {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    // The raw body is attached by our middleware in configure-app.ts
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      throw new BadRequestException(
        'Raw body not available. Ensure rawBodyMiddleware is configured.',
      );
    }

    // Verify the webhook signature.
    // This proves the event came from Stripe and wasn't tampered with.
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature as string,
        this.config.features.stripe.webhookSecret!,
      );
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    // Process the event asynchronously.
    // We return 200 quickly so Stripe doesn't retry.
    // Errors in processing are logged but don't cause a retry.
    try {
      await this.webhookService.handleEvent(event);
    } catch (err) {
      // Log but don't throw — we already verified the event is legit.
      // Throwing would cause Stripe to retry, which might not help.
      this.logger.error(
        `Error processing webhook ${event.type} (${event.id}): ${(err as Error).message}`,
        (err as Error).stack,
      );
    }

    return { received: true };
  }
}
