import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

/**
 * # Logging Module
 *
 * Structured logging via Pino. All HTTP requests are automatically logged.
 *
 * ## Configuration
 *
 * - **Development**: Pretty-printed, colorized output via `pino-pretty`
 * - **Production**: JSON structured logs (parseable by log aggregators)
 * - **Sensitive data**: Authorization headers and cookies are redacted
 *
 * ## Log Levels
 *
 * Set via `LOG_LEVEL` env var: `fatal`, `error`, `warn`, `info`, `debug`, `trace`
 * Default: `info`
 *
 * ## Usage
 *
 * NestJS Logger is automatically replaced by Pino. Use the standard Logger:
 *
 * ```typescript
 * import { Logger } from '@nestjs/common';
 *
 * @Injectable()
 * export class MyService {
 *   private readonly logger = new Logger(MyService.name);
 *
 *   doSomething() {
 *     this.logger.log('Something happened');
 *     this.logger.error('Something failed', error.stack);
 *   }
 * }
 * ```
 */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: false,
                  translateTime: 'HH:MM:ss',
                  ignore: 'pid,hostname',
                },
              }
            : undefined, // JSON in production
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
          ],
          censor: '[REDACTED]',
        },
        // Don't log health check requests (noisy)
        autoLogging: {
          ignore: (req) =>
            (req as unknown as { url?: string }).url === '/health',
        },
      },
    }),
  ],
})
export class LoggingModule {}
