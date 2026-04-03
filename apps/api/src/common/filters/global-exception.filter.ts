import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import type { ApiErrorResponse, ApiFieldError } from '@paisa/shared';

/**
 * # Global Exception Filter
 *
 * Catches all exceptions and returns a consistent error response shape.
 *
 * ## Error mapping
 *
 * | Exception Type | HTTP Status | Error Code |
 * |---|---|---|
 * | `HttpException` | From exception | From exception |
 * | Unknown | 500 | `INTERNAL_ERROR` |
 *
 * ## Validation errors
 *
 * Zod validation errors are converted to `BadRequestException` by the
 * `ZodValidationPipe` BEFORE reaching this filter. The pipe throws:
 *
 * ```typescript
 * new BadRequestException({
 *   code: 'VALIDATION_ERROR',
 *   message: 'Validation failed',
 *   details: [{ field: 'email', message: 'Invalid email address' }]
 * })
 * ```
 *
 * This filter then extracts the structured payload and returns it in
 * the standard error envelope. This approach avoids the fragile
 * `instanceof ZodError` check across ESM/CJS module boundaries.
 *
 * ## Response format
 *
 * ```json
 * {
 *   "error": {
 *     "code": "VALIDATION_ERROR",
 *     "message": "Validation failed",
 *     "details": [{ "field": "email", "message": "Invalid email" }]
 *   }
 * }
 * ```
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const errorResponse = this.buildErrorResponse(exception);

    // Log server errors, not client errors
    if (errorResponse.status >= 500) {
      this.logger.error(
        `${errorResponse.status} ${errorResponse.body.error.code}: ${errorResponse.body.error.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(errorResponse.status).json(errorResponse.body);
  }

  private buildErrorResponse(exception: unknown): {
    status: number;
    body: ApiErrorResponse;
  } {
    // NestJS HTTP exceptions (includes BadRequestException from ZodValidationPipe)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // String response: simple message
      if (typeof exceptionResponse === 'string') {
        return {
          status,
          body: {
            error: {
              code: this.httpStatusToCode(status),
              message: exceptionResponse,
            },
          },
        };
      }

      // Object response: could be our structured validation error or NestJS default
      if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;

        // Our ZodValidationPipe format: { code, message, details }
        if (resp.code && resp.message && Array.isArray(resp.details)) {
          return {
            status,
            body: {
              error: {
                code: resp.code as string,
                message: resp.message as string,
                details: resp.details as ApiFieldError[],
              },
            },
          };
        }

        // NestJS class-validator style: { message: string[] }
        let message: string;
        let details: ApiFieldError[] | undefined;

        if (Array.isArray(resp.message)) {
          details = (resp.message as string[]).map((msg) => ({
            field: '',
            message: msg,
          }));
          message = 'Validation failed';
        } else {
          message = (resp.message as string) || exception.message;
        }

        return {
          status,
          body: {
            error: {
              code: this.httpStatusToCode(status),
              message,
              details,
            },
          },
        };
      }

      // Fallback
      return {
        status,
        body: {
          error: {
            code: this.httpStatusToCode(status),
            message: exception.message,
          },
        },
      };
    }

    // Unknown errors — don't leak internal details
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
    };
  }

  private httpStatusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return map[status] || `HTTP_${status}`;
  }
}
