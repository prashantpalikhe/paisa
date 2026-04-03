import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * # Response Transform Interceptor
 *
 * Wraps all successful responses in a standard `{ data: ... }` envelope.
 *
 * ## Before (raw controller return)
 * ```json
 * { "id": "123", "name": "Alice" }
 * ```
 *
 * ## After (interceptor applied)
 * ```json
 * { "data": { "id": "123", "name": "Alice" } }
 * ```
 *
 * ## Exceptions
 *
 * - Health check responses are NOT wrapped (they have their own shape)
 * - Responses that already have a `data` key are NOT double-wrapped
 * - Error responses are handled by GlobalExceptionFilter, not this interceptor
 */
@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, { data: T } | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{ data: T } | T> {
    const request = context.switchToHttp().getRequest();

    // Skip wrapping for health check
    if (request.url === '/health') {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // Don't double-wrap if already wrapped
        if (
          data &&
          typeof data === 'object' &&
          'data' in (data as object)
        ) {
          return data;
        }

        return { data };
      }),
    );
  }
}
