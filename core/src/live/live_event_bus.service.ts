import { EventEmitter } from 'node:events';

import { Injectable, Logger } from '@nestjs/common';

type BusListener<Payload> = (payload: Payload) => void | Promise<void>;

// In-process pub/sub: every Redis live event is re-published here, together
// with core's own internal events (interventions, ended calls).
@Injectable()
export class LiveEventBus {
  private readonly logger = new Logger(LiveEventBus.name);
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish(event_name: string, payload: unknown): void {
    this.emitter.emit(event_name, payload);
  }

  // Returns the function that removes the listener again.
  subscribe<Payload>(
    event_name: string,
    listener: BusListener<Payload>,
  ): () => void {
    const guarded_listener = (payload: Payload) => {
      // A failing listener must never take the process (or other listeners) down.
      Promise.resolve()
        .then(() => listener(payload))
        .catch((error: Error) => {
          this.logger.error(
            `Listener for ${event_name} failed: ${error.message}`,
            error.stack,
          );
        });
    };
    this.emitter.on(event_name, guarded_listener);
    return () => this.emitter.off(event_name, guarded_listener);
  }
}
