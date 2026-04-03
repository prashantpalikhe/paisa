/**
 * # App Configuration
 *
 * Applies all global middleware, filters, interceptors, and security
 * settings to a NestJS application instance.
 *
 * ## Why a separate file?
 *
 * Both `main.ts` (production) and `createTestApp()` (e2e tests) need
 * identical middleware. If they configure the app separately, they WILL
 * drift apart — tests pass but production behaves differently.
 *
 * By extracting configuration into one function, there is a single
 * source of truth. When you add a new global pipe or middleware,
 * both production and tests get it automatically.
 *
 * ## What this does NOT configure
 *
 * - Logger (Pino) — only needed in production, tests use silent mode
 * - Swagger / Scalar — only needed in production, not relevant to tests
 * - Listening on a port — tests use supertest, not a real HTTP server
 */
import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppConfigService } from './core/config/config.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

export function configureApp(app: INestApplication): void {
  // ─── Security ───
  app.use(helmet());
  app.use(cookieParser());

  // ─── CORS ───
  const config = app.get(AppConfigService);
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true, // Required for httpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  // ─── Global filters & interceptors ───
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());
}
