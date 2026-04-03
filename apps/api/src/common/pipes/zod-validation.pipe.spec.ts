import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  });

  const pipe = new ZodValidationPipe(schema);
  const metadata = { type: 'body' as const, metatype: undefined, data: '' };

  it('should pass valid data through', () => {
    const input = { email: 'test@example.com', password: 'password123' };
    const result = pipe.transform(input, metadata);
    expect(result).toEqual(input);
  });

  it('should throw BadRequestException for invalid data', () => {
    const input = { email: 'not-an-email', password: '123' };

    expect(() => pipe.transform(input, metadata)).toThrow(BadRequestException);
  });

  it('should include field-level error details', () => {
    const input = { email: 'not-an-email', password: '123' };

    try {
      pipe.transform(input, metadata);
      expect.unreachable('Should have thrown');
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as any;
      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.message).toBe('Validation failed');
      expect(response.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email', message: 'Invalid email' }),
          expect.objectContaining({ field: 'password', message: 'Password must be at least 8 characters' }),
        ]),
      );
    }
  });

  it('should give clear error when body is missing', () => {
    try {
      pipe.transform(undefined, metadata);
      expect.unreachable('Should have thrown');
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as any;
      expect(response.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'body', message: 'Request body is required' }),
        ]),
      );
    }
  });

  it('should strip unknown fields', () => {
    const input = {
      email: 'test@example.com',
      password: 'password123',
      extra: 'should-be-stripped',
    };
    const result = pipe.transform(input, metadata);
    expect(result).not.toHaveProperty('extra');
  });
});
