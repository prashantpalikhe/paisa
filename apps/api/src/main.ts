import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfigService } from './core/config/config.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until Pino logger is ready
  });

  // ─── Logger ───
  app.useLogger(app.get(Logger));

  // ─── Config ───
  const config = app.get(AppConfigService);

  // ─── Security ───
  app.use(helmet());
  app.use(cookieParser());

  // ─── CORS ───
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true, // Required for httpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  // ─── Global pipes, filters, interceptors ───
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // ─── OpenAPI + Scalar ───
  const openApiConfig = new DocumentBuilder()
    .setTitle('Paisa API')
    .setDescription('API documentation for the Paisa boilerplate')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);

  // Scalar UI at /api/docs
  app.use(
    '/api/docs',
    apiReference({
      spec: { content: document },
      theme: 'kepler',
    }),
  );

  // Raw OpenAPI JSON at /api/docs/json (useful for code generation)
  SwaggerModule.setup('api/swagger', app, document);

  // ─── Start ───
  const port = config.env.API_PORT;
  await app.listen(port);

  const logger = new (await import('@nestjs/common')).Logger('Bootstrap');
  logger.log(`🚀 API running on http://localhost:${port}`);
  logger.log(`📚 API docs at http://localhost:${port}/api/docs`);
  logger.log(`📋 Swagger at http://localhost:${port}/api/swagger`);
}

bootstrap();
