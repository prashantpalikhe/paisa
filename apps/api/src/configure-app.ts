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
import { join } from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import { AppConfigService } from './core/config/config.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

export function configureApp(app: INestApplication): void {
  // ─── Security ───
  // Helmet sets HTTP security headers (XSS, clickjacking, MIME sniffing, etc.).
  // We relax the Content Security Policy in development so Scalar API docs
  // can load its UI from cdn.jsdelivr.net and run inline scripts.
  const config = app.get(AppConfigService);

  app.use(
    helmet({
      contentSecurityPolicy: config.isDevelopment
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
              styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
              fontSrc: ["'self'", 'fonts.gstatic.com'],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
            },
          }
        : undefined, // Use Helmet's strict defaults in production
      // Allow cross-origin resource loading. The API is consumed from a
      // different origin (frontend at :3000, API at :3001 in dev). Helmet's
      // default `same-origin` blocks the browser from loading images (avatars)
      // and other resources served by the API. Since we already configure CORS
      // to control which origins can access the API, this is safe.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  // ─── CORS ───
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true, // Required for httpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  // ─── Static files (local uploads in development) ───
  // In development, LocalStorageProvider saves files to `uploads/`.
  // This middleware serves them at `/uploads/*` so avatar URLs work.
  // In production, files are on Cloudflare R2 with a CDN URL — this is unused.
  if (config.isDevelopment || config.isTest) {
    const uploadsPath = join(process.cwd(), 'uploads');
    app.use('/uploads', express.static(uploadsPath));
  }

  // ─── Global filters & interceptors ───
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());
}
