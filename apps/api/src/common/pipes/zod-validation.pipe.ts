import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ZodSchema } from 'zod';

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
 * ## Error format
 *
 * Throws `BadRequestException` with field-level error details.
 * The GlobalExceptionFilter converts ZodErrors to the standard error response shape.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw result.error; // ZodError — caught by GlobalExceptionFilter
    }

    return result.data;
  }
}
