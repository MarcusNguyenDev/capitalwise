import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import {
  INTERNAL_EVENT,
  LIVE_EVENT,
} from '../live/constants/live_event_names.constant';
import { LiveEventBus } from '../live/live_event_bus.service';
import { buildCallRoomName } from './constants/call_room.constant';
import { LivekitRoomsService } from './livekit_rooms.service';

// A call's room is deleted when the call ends, whatever the mode or the
// path (hang-up, staff ending it, a demo reset), so no phone or dashboard is
// left connected to a finished call.
@Injectable()
export class CallRoomLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallRoomLifecycleService.name);
  private readonly unsubscribe_functions: (() => void)[] = [];

  constructor(
    private readonly live_event_bus: LiveEventBus,
    private readonly livekit_rooms_service: LivekitRoomsService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe_functions.push(
      this.live_event_bus.subscribe<{ call_id: string }>(
        INTERNAL_EVENT.CALL_ENDED,
        (ended_call) =>
          this.livekit_rooms_service.deleteRoom(
            buildCallRoomName(ended_call.call_id),
          ),
      ),
      this.live_event_bus.subscribe(LIVE_EVENT.DEMO_RESET, async () => {
        this.logger.log('Demo reset received: deleting every call room');
        await this.livekit_rooms_service.deleteAllCallRooms();
      }),
    );
  }

  onModuleDestroy(): void {
    this.unsubscribe_functions.forEach((unsubscribe) => unsubscribe());
  }
}
