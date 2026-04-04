/**
 * # Stripe Pricing Controller
 *
 * Public endpoint for the pricing page.
 *
 * Reads from our database (not the Stripe API) for speed.
 * The database is the source of truth for product catalog display.
 * Stripe is only the source of truth for payment state.
 */
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { DatabaseService } from '../../../core/database/database.service';

@ApiTags('Stripe')
@Controller('stripe')
export class StripePricingController {
  constructor(private readonly db: DatabaseService) {}

  /**
   * GET /stripe/pricing
   *
   * Returns all active products with their active plans.
   * Used by the frontend pricing page.
   *
   * No authentication required — pricing is always public.
   */
  @Public()
  @Get('pricing')
  @ApiOperation({ summary: 'Get active products and plans for pricing page' })
  @ApiResponse({ status: 200, description: 'List of products with plans' })
  async getPricing(): Promise<{ id: string; name: string; description: string | null; plans: any[] }[]> {
    const products = await this.db.product.findMany({
      where: { active: true },
      include: {
        plans: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            priceInCents: true,
            currency: true,
            interval: true,
            intervalCount: true,
            trialDays: true,
            features: true,
            highlighted: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      plans: product.plans,
    }));
  }
}
