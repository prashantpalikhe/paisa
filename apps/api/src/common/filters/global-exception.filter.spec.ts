import { describe, it, expect, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  function createMockHost(mockJson: ReturnType<typeof vi.fn>) {
    const mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: mockJson,
    };

    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({}),
      }),
    } as any;
  }

  it('should handle HttpException with string message', () => {
    const json = vi.fn();
    const host = createMockHost(json);

    filter.catch(new NotFoundException('User not found'), host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'User not found',
      },
    });
  });

  it('should handle HttpException with object response', () => {
    const json = vi.fn();
    const host = createMockHost(json);

    filter.catch(new BadRequestException('Invalid input'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'BAD_REQUEST',
        }),
      }),
    );
  });

  it('should handle structured validation errors from ZodValidationPipe', () => {
    const json = vi.fn();
    const host = createMockHost(json);

    // This is what ZodValidationPipe throws:
    const exception = new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [
        { field: 'email', message: 'Invalid email address' },
        { field: 'password', message: 'Password must be at least 8 characters' },
      ],
    });

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [
          { field: 'email', message: 'Invalid email address' },
          { field: 'password', message: 'Password must be at least 8 characters' },
        ],
      },
    });
  });

  it('should handle NestJS class-validator style errors (message array)', () => {
    const json = vi.fn();
    const host = createMockHost(json);

    // NestJS class-validator format: { message: string[] }
    const exception = new BadRequestException({
      message: ['email must be valid', 'name must not be empty'],
    });

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_REQUEST',
        message: 'Validation failed',
        details: [
          { field: '', message: 'email must be valid' },
          { field: '', message: 'name must not be empty' },
        ],
      },
    });
  });

  it('should handle unknown errors without leaking details', () => {
    const json = vi.fn();
    const host = createMockHost(json);

    filter.catch(new Error('DB connection failed'), host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  it('should handle ForbiddenException', () => {
    const json = vi.fn();
    const host = createMockHost(json);

    filter.catch(new ForbiddenException('Access denied'), host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied',
      },
    });
  });
});
