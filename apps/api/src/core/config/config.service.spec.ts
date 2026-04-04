import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './config.service';

describe('AppConfigService', () => {
  const validEnv = {
    NODE_ENV: 'test',
    API_PORT: '3001',
    API_BASE_URL: 'http://localhost:3001',
    FRONTEND_URL: 'http://localhost:3000',
    ADMIN_URL: 'http://localhost:3002',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
    // All features disabled by default for tests
  };

  let service: AppConfigService;

  beforeEach(async () => {
    // Set env vars
    for (const [key, value] of Object.entries(validEnv)) {
      process.env[key] = value;
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true })],
      providers: [AppConfigService],
    }).compile();

    service = module.get(AppConfigService);
  });

  it('should parse core env vars', () => {
    expect(service.env.NODE_ENV).toBe('test');
    expect(service.env.API_PORT).toBe(3001);
    expect(service.env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it('should default all optional features to disabled', () => {
    expect(service.features.stripe.enabled).toBe(false);
    expect(service.features.redis.enabled).toBe(false);
    expect(service.features.rabbitmq.enabled).toBe(false);
    expect(service.features.sentry.enabled).toBe(false);
    expect(service.features.websockets.enabled).toBe(false);
  });

  it('should detect test environment', () => {
    expect(service.isTest).toBe(true);
    expect(service.isProduction).toBe(false);
    expect(service.isDevelopment).toBe(false);
  });

  it('should return lax cookie policy for development/test', () => {
    expect(service.cookieSameSite).toBe('lax');
  });

  it('should return none cookie policy for cross-site production', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://app.vercel.app';
    process.env.API_BASE_URL = 'https://api.railway.app';
    // Email config required in production (no feature flag gate)
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'test@example.com';

    // Recreate service with new env
    const config = new AppConfigService({
      get: (key: string) => process.env[key],
    } as any);

    expect(config.cookieSameSite).toBe('none');
  });

  it('should return lax cookie policy for same-site production', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://myapp.com';
    process.env.API_BASE_URL = 'https://api.myapp.com';
    // Email config required in production (no feature flag gate)
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'test@example.com';

    const config = new AppConfigService({
      get: (key: string) => process.env[key],
    } as any);

    expect(config.cookieSameSite).toBe('lax');
  });

  it('should return CORS origins', () => {
    expect(service.corsOrigins).toEqual([
      'http://localhost:3000',
      'http://localhost:3002',
    ]);
  });
});
