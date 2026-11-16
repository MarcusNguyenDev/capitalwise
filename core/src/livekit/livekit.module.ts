import { Module } from '@nestjs/common';

import { LiveModule } from '../live/live.module';
import { CallRoomLifecycleService } from './call_room_lifecycle.service';
import { LivekitRoomsService } from './livekit_rooms.service';
import { LivekitTokensService } from './livekit_tokens.service';

@Module({
  imports: [LiveModule],
  providers: [
    LivekitTokensService,
    LivekitRoomsService,
    CallRoomLifecycleService,
  ],
  exports: [LivekitTokensService, LivekitRoomsService],
})
export class LivekitModule {}
