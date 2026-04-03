import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ZodError } from 'zod';
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
 * | `ZodError` | 400 | `VALIDATION_ERROR` |
 * | Unknown | 500 | `INTERNAL_ERROR` |
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
    // Zod validation errors
    if (exception instanceof ZodError) {
      const details: ApiFieldError[] = exception.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details,
          },
        },
      };
    }

    // NestJS HTTP exceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let details: ApiFieldError[] | undefined;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;

        // NestJS class-validator style errors
        if (Array.isArray(resp.message)) {
          details = (resp.message as string[]).map((msg) => ({
            field: '',
            message: msg,
          }));
          message = 'Validation failed';
        }
      } else {
        message = exception.message;
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
