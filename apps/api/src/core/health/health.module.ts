import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * # Health Module
 *
 * Provides `/health` endpoint for load balancers, uptime monitors,
 * and CI `wait-on` checks.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
