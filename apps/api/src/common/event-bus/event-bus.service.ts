import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * # Event Bus Service
 *
 * Abstraction for publishing domain events.
 * Core modules should ONLY use this service to trigger side effects
 * in optional modules (email, queue, notifications, etc.).
 *
 * NEVER import optional module services directly from core modules.
 *
 * ## Event payload convention
 *
 * All events carry a typed payload object. Event names are defined
 * in `@paisa/shared` `DOMAIN_EVENTS` constants.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Emit a domain event.
   *
   * When RabbitMQ is disabled: Handlers run synchronously in-process.
   * When RabbitMQ is enabled: The QueueModule intercepts and publishes to RMQ.
   */
  async emit(event: string, payload: Record<string, unknown>): Promise<void> {
    this.logger.debug(`Emitting event: ${event}`);
    this.eventEmitter.emit(event, payload);
  }

  /**
   * Emit and wait for all handlers to complete.
   * Use sparingly — prefer fire-and-forget `emit()` for non-blocking flows.
   */
  async emitAndWait(
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.logger.debug(`Emitting event (await): ${event}`);
    await this.eventEmitter.emitAsync(event, payload);
  }
}
