import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBusService } from './event-bus.service';

/**
 * # Event Bus Module
 *
 * Provides the EventBus abstraction for decoupled communication between modules.
 * Core modules emit domain events; optional modules listen for them.
 *
 * This is the foundation of Architectural Invariant #2:
 * "Optional integrations never leak into core domain."
 *
 * ## How it works
 *
 * - When RabbitMQ is **disabled**: Events are handled synchronously in-process
 *   via NestJS EventEmitter (this module).
 * - When RabbitMQ is **enabled**: The QueueModule wraps this service to publish
 *   events to RabbitMQ queues for async processing.
 *
 * ## Usage
 *
 * ```typescript
 * // In a core module (producer):
 * this.eventBus.emit('user.registered', { userId: user.id });
 *
 * // In an optional module (consumer):
 * @OnEvent('user.registered')
 * handleUserRegistered(payload: { userId: string }) { ... }
 * ```
 *
 * See `@paisa/shared` `DOMAIN_EVENTS` for all event names.
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Wildcard listeners allow subscribing to event groups
      wildcard: true,
      delimiter: '.',
      // Don't throw on unhandled events — optional listeners may not be registered
      ignoreErrors: true,
    }),
  ],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}
