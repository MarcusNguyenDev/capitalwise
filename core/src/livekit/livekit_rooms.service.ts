import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { RoomServiceClient } from 'livekit-server-sdk';

import { livekitConfig } from '../config/livekit.config';
import { CALL_ROOM_PREFIX } from './constants/call_room.constant';
import { LivekitTokensService } from './livekit_tokens.service';
import { MediaAvailability } from './types/room_grant.type';

const AVAILABILITY_CACHE_TTL_MS = 15_000;

// The room service API speaks HTTP on the same port as the signalling socket.
function toHttpUrl(livekit_url: string): string {
  return livekit_url.replace(/^ws(s?):\/\//, 'http$1://');
}

@Injectable()
export class LivekitRoomsService {
  private readonly logger = new Logger(LivekitRoomsService.name);
  private cached_availability: {
    checked_at_ms: number;
    availability_promise: Promise<MediaAvailability>;
  } | null = null;

  constructor(
    @Inject(livekitConfig.KEY)
    private readonly livekit_config: ConfigType<typeof livekitConfig>,
    private readonly livekit_tokens_service: LivekitTokensService,
  ) {}

  // How core itself connects (in Docker: ws://media:7880).
  readServerUrl(): string {
    return this.livekit_config.url;
  }

  // What browsers use; null means "ws://<page hostname>:7880".
  readBrowserUrl(): string | null {
    return this.livekit_config.public_url || null;
  }

  // Configured and answering an HTTP GET on the server root (cached 15 s).
  checkAvailability(): Promise<MediaAvailability> {
    if (
      this.cached_availability &&
      Date.now() - this.cached_availability.checked_at_ms <
        AVAILABILITY_CACHE_TTL_MS
    ) {
      return this.cached_availability.availability_promise;
    }
    const availability_promise = this.probeServer();
    this.cached_availability = {
      checked_at_ms: Date.now(),
      availability_promise,
    };
    return availability_promise;
  }

  // Disconnects everyone; a room that is already gone is fine.
  async deleteRoom(room_name: string): Promise<void> {
    if (!this.livekit_tokens_service.isConfigured()) {
      return;
    }
    try {
      await this.createRoomServiceClient().deleteRoom(room_name);
    } catch (error) {
      this.logger.debug(
        `Room ${room_name} was not deleted: ${(error as Error).message}`,
      );
    }
  }

  async deleteAllCallRooms(): Promise<void> {
    if (!this.livekit_tokens_service.isConfigured()) {
      return;
    }
    try {
      const rooms = await this.createRoomServiceClient().listRooms();
      const call_rooms = rooms.filter((room) =>
        room.name.startsWith(CALL_ROOM_PREFIX),
      );
      await Promise.all(call_rooms.map((room) => this.deleteRoom(room.name)));
    } catch (error) {
      this.logger.warn(
        `Could not list LiveKit rooms: ${(error as Error).message}`,
      );
    }
  }

  private createRoomServiceClient(): RoomServiceClient {
    return new RoomServiceClient(
      toHttpUrl(this.livekit_config.url),
      this.livekit_config.api_key,
      this.livekit_config.api_secret,
    );
  }

  private async probeServer(): Promise<MediaAvailability> {
    if (!this.livekit_tokens_service.isConfigured()) {
      return {
        is_available: false,
        unavailable_reason:
          'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in core/.env.',
      };
    }
    const server_url = toHttpUrl(this.livekit_config.url);
    try {
      const response = await fetch(server_url, {
        signal: AbortSignal.timeout(
          this.livekit_config.health_check_timeout_ms,
        ),
      });
      return response.ok
        ? { is_available: true, unavailable_reason: null }
        : {
            is_available: false,
            unavailable_reason: `LiveKit at ${server_url} answered HTTP ${response.status}.`,
          };
    } catch (error) {
      return {
        is_available: false,
        unavailable_reason: `LiveKit at ${server_url} is not reachable (${(error as Error).message}).`,
      };
    }
  }
}
