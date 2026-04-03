import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBusService } from './event-bus.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('EventBusService', () => {
  let service: EventBusService;
  let mockEmitter: { emit: ReturnType<typeof vi.fn>; emitAsync: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockEmitter = {
      emit: vi.fn(),
      emitAsync: vi.fn().mockResolvedValue(undefined),
    };
    service = new EventBusService(mockEmitter as unknown as EventEmitter2);
  });

  it('should emit events via EventEmitter2', async () => {
    await service.emit('user.registered', { userId: '123' });

    expect(mockEmitter.emit).toHaveBeenCalledWith('user.registered', {
      userId: '123',
    });
  });

  it('should emit and wait for async handlers', async () => {
    await service.emitAndWait('user.registered', { userId: '123' });

    expect(mockEmitter.emitAsync).toHaveBeenCalledWith('user.registered', {
      userId: '123',
    });
  });
});
