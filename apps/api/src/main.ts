import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { brand } from '@paisa/config';
import { AppModule } from './app.module';
import { AppConfigService } from './core/config/config.service';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until Pino logger is ready
  });

  // ─── Logger ───
  app.useLogger(app.get(Logger));

  // ─── Middleware, security, filters, interceptors ───
  // Shared with e2e tests via configure-app.ts — NEVER add middleware
  // here directly. Add it to configureApp() so tests get it too.
  configureApp(app);

  // ─── API Documentation ───
  //
  // @nestjs/swagger generates the OpenAPI spec from decorators.
  // Scalar renders it as a beautiful interactive UI (replaces Swagger UI).
  //
  // - /api/docs     → Scalar UI (interactive API explorer)
  // - /api/docs.json → Raw OpenAPI JSON (for code generation, Postman, etc.)
  //
  const openApiConfig = new DocumentBuilder()
    .setTitle(`${brand.name} API`)
    .setDescription(`API documentation for ${brand.name} — ${brand.description}`)
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);

  // Scalar UI — modern replacement for Swagger UI
  app.use(
    '/api/docs',
    apiReference({
      spec: { content: document },
      theme: 'kepler',
    }),
  );

  // Raw OpenAPI JSON endpoint — used by:
  // - Code generation tools (openapi-generator, orval)
  // - API clients (Postman, Insomnia)
  // - CI validation scripts
  app.getHttpAdapter().get('/api/docs.json', (_req: any, res: any) => {
    res.json(document);
  });

  // ─── Graceful Shutdown ───
  // NestJS calls OnModuleDestroy hooks (DB disconnect, Redis close, intervals)
  // when it receives SIGTERM/SIGINT. enableShutdownHooks() wires that up.
  // Without this, `docker stop` / Kubernetes pod termination kills the process
  // immediately without draining in-flight requests or closing connections.
  app.enableShutdownHooks();

  // ─── Start ───
  const config = app.get(AppConfigService);
  const port = config.env.API_PORT;
  await app.listen(port);

  const logger = new (await import('@nestjs/common')).Logger('Bootstrap');
  logger.log(`API running on http://localhost:${port}`);
  logger.log(`API docs at http://localhost:${port}/api/docs`);
}

bootstrap();
