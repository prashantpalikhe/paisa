/**
 * # Stripe Subscription Controller
 *
 * Endpoints for viewing and managing the current user's subscriptions.
 *
 * ## Endpoints
 *
 * ```
 * GET  /stripe/subscription         → Get active subscription
 * GET  /stripe/purchases            → Get all purchases (subscriptions + one-time)
 * POST /stripe/subscription/cancel  → Cancel subscription at period end
 * POST /stripe/subscription/resume  → Undo pending cancellation
 * ```
 */
import {
  Body,
  Controller,
  Get,
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
import { StripeSubscriptionService } from '../services/stripe-subscription.service';
import type { AuthUser } from '@paisa/shared';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeSubscriptionController {
  constructor(
    private readonly subscriptionService: StripeSubscriptionService,
  ) {}

  /**
   * Get the current user's active subscription.
   * Returns null if no active subscription exists.
   */
  @Get('subscription')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get your active subscription' })
  @ApiResponse({ status: 200, description: 'Active subscription or null' })
  async getSubscription(@CurrentUser() user: AuthUser): Promise<any> {
    const subscription = await this.subscriptionService.getActiveSubscription(user.id);
    return subscription ?? null;
  }

  /**
   * Get all purchases for the current user.
   * Includes active, canceled, and expired subscriptions plus one-time payments.
   */
  @Get('purchases')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all your purchases' })
  @ApiResponse({ status: 200, description: 'All subscriptions and payments' })
  async getPurchases(@CurrentUser() user: AuthUser): Promise<{ subscriptions: any[]; payments: any[] }> {
    const [subscriptions, payments] = await Promise.all([
      this.subscriptionService.getAllSubscriptions(user.id),
      this.subscriptionService.getPayments(user.id),
    ]);

    return { subscriptions, payments };
  }

  /**
   * Cancel the active subscription at the end of the billing period.
   * The user keeps access until the period ends.
   */
  @Post('subscription/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel subscription at period end' })
  @ApiResponse({ status: 200, description: 'Cancellation scheduled' })
  @ApiResponse({ status: 404, description: 'No active subscription found' })
  async cancelSubscription(
    @CurrentUser() user: AuthUser,
    @Body() body: { subscriptionId: string },
  ) {
    await this.subscriptionService.cancelSubscription(user.id, body.subscriptionId);
    return { message: 'Subscription will be canceled at the end of the billing period.' };
  }

  /**
   * Resume a subscription that was scheduled for cancellation.
   */
  @Post('subscription/resume')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resume a pending cancellation' })
  @ApiResponse({ status: 200, description: 'Subscription resumed' })
  @ApiResponse({ status: 404, description: 'No pending cancellation found' })
  async resumeSubscription(
    @CurrentUser() user: AuthUser,
    @Body() body: { subscriptionId: string },
  ) {
    await this.subscriptionService.resumeSubscription(user.id, body.subscriptionId);
    return { message: 'Subscription resumed. It will renew normally.' };
  }
}
