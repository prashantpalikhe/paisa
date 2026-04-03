import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { DatabaseService } from '../database/database.service';
import { AppConfigService } from '../config/config.service';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  checks: {
    database: boolean;
    // Future: redis, rabbitmq, etc.
  };
  features: Record<string, boolean>;
}

/**
 * # Health Controller
 *
 * Exposes application health status.
 *
 * - `GET /health` — Returns overall health + individual check results
 *
 * Used by:
 * - Railway health checks (auto-configured)
 * - CI `wait-on` commands
 * - Admin panel system health page
 * - Load balancers
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Application health check' })
  async check(): Promise<HealthStatus> {
    const dbHealthy = await this.db.isHealthy();

    const status = dbHealthy ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbHealthy,
      },
      features: {
        email: this.config.features.email.enabled,
        stripe: this.config.features.stripe.enabled,
        redis: this.config.features.redis.enabled,
        rabbitmq: this.config.features.rabbitmq.enabled,
        storage: this.config.features.storage.enabled,
        websockets: this.config.features.websockets.enabled,
        sentry: this.config.features.sentry.enabled,
      },
    };
  }
}
