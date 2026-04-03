import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DatabaseService } from '../database/database.service';
import { AppConfigService } from '../config/config.service';

describe('HealthController', () => {
  let controller: HealthController;
  let mockDb: { isHealthy: ReturnType<typeof vi.fn> };

  const mockConfig = {
    features: {
      email: { enabled: false },
      stripe: { enabled: false },
      redis: { enabled: true },
      rabbitmq: { enabled: false },
      storage: { enabled: false },
      websockets: { enabled: false },
      sentry: { enabled: false },
    },
  };

  beforeEach(async () => {
    mockDb = { isHealthy: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DatabaseService, useValue: mockDb },
        { provide: AppConfigService, useValue: mockConfig },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('should return ok status when database is healthy', async () => {
    mockDb.isHealthy.mockResolvedValue(true);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.checks.database).toBe(true);
    expect(result.timestamp).toBeDefined();
    expect(result.uptime).toBeGreaterThan(0);
  });

  it('should return degraded status when database is unhealthy', async () => {
    mockDb.isHealthy.mockResolvedValue(false);

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe(false);
  });

  it('should include feature flags in response', async () => {
    mockDb.isHealthy.mockResolvedValue(true);

    const result = await controller.check();

    expect(result.features).toEqual({
      email: false,
      stripe: false,
      redis: true,
      rabbitmq: false,
      storage: false,
      websockets: false,
      sentry: false,
    });
  });
});
