/**
 * # ThrottleModule Unit Tests
 *
 * Verifies that the throttle module bootstraps correctly.
 */
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { ThrottleModule } from './throttle.module';

describe('ThrottleModule', () => {
  it('should compile successfully', async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottleModule],
    }).compile();

    expect(module).toBeDefined();
  });
});
