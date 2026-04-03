import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * # Zod Validation Pipe
 *
 * Validates request data against a Zod schema.
 *
 * ## Usage
 *
 * ```typescript
 * import { loginSchema } from '@paisa/shared';
 *
 * @Post('login')
 * async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginRequest) {
 *   // body is validated and typed
 * }
 * ```
 *
 * ## Error handling
 *
 * On validation failure, throws a `BadRequestException` with a structured payload
 * that the GlobalExceptionFilter converts to the standard error shape:
 *
 * ```json
 * {
 *   "error": {
 *     "code": "VALIDATION_ERROR",
 *     "message": "Validation failed",
 *     "details": [
 *       { "field": "email", "message": "Invalid email address" },
 *       { "field": "password", "message": "Password must be at least 8 characters" }
 *     ]
 *   }
 * }
 * ```
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      // Convert ZodError into a structured BadRequestException.
      // This gives us control over the error format instead of relying on
      // the GlobalExceptionFilter's ZodError detection (which can be fragile
      // across ESM/CJS module boundaries).
      const details = this.formatErrors(result.error);

      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
      });
    }

    return result.data;
  }

  /**
   * Convert Zod errors into field-level error details.
   *
   * Zod gives us: `{ path: ["email"], message: "Invalid email address" }`
   * We return:     `{ field: "email", message: "Invalid email address" }`
   *
   * Special case: when the entire body is missing (undefined/null),
   * Zod gives a single error with `path: []` and `message: "Required"`.
   * We replace that with a clearer message listing the expected fields.
   */
  private formatErrors(error: ZodError): Array<{ field: string; message: string }> {
    return error.errors.map((err) => {
      const field = err.path.join('.');

      // Empty path means the root value itself is invalid (e.g., body is undefined)
      if (!field && err.message === 'Required') {
        return {
          field: 'body',
          message: 'Request body is required',
        };
      }

      return { field, message: err.message };
    });
  }
}
