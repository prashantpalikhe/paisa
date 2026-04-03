import { describe, it, expect, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ZodError } from 'zod';
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
        details: undefined,
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

  it('should handle ZodError', () => {
    const json = vi.fn();
    const host = createMockHost(json);

    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['email'],
        message: 'Required',
      },
    ]);

    filter.catch(zodError, host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [{ field: 'email', message: 'Required' }],
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
        details: undefined,
      },
    });
  });
});
