import { Injectable, Logger } from '@nestjs/common';

import { LiveGateway } from './live.gateway';

@Injectable()
export class LiveBroadcaster {
  private readonly logger = new Logger(LiveBroadcaster.name);

  constructor(private readonly live_gateway: LiveGateway) {}

  emitToRooms(event_name: string, payload: unknown, rooms: string[]): void {
    const server = this.live_gateway.server;
    if (!server || rooms.length === 0) {
      return;
    }
    try {
      // One emit to the union of rooms: a socket in two of them gets it once.
      server.to(rooms).emit(event_name, payload);
    } catch (error) {
      this.logger.error(
        `Could not emit ${event_name}: ${(error as Error).message}`,
      );
    }
  }

  emitToEveryone(event_name: string, payload: unknown): void {
    this.live_gateway.server?.emit(event_name, payload);
  }
}
