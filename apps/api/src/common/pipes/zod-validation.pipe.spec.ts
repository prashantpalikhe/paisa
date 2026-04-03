import { describe, it, expect } from 'vitest';
import { z, ZodError } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });

  const pipe = new ZodValidationPipe(schema);
  const metadata = { type: 'body' as const, metatype: undefined, data: '' };

  it('should pass valid data through', () => {
    const input = { email: 'test@example.com', password: 'password123' };
    const result = pipe.transform(input, metadata);
    expect(result).toEqual(input);
  });

  it('should throw ZodError for invalid data', () => {
    const input = { email: 'not-an-email', password: '123' };

    expect(() => pipe.transform(input, metadata)).toThrow(ZodError);
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
