import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { collectValidationMessages } from '../shared_kernel/collect_validation_messages.util';
import { LIVE_EVENT } from './constants/live_event_names.constant';
import {
  buildCallRoom,
  buildCustomerRoom,
  STAFF_ROOM,
} from './constants/live_rooms.constant';
import { JoinRoomsDto } from './dto/join_rooms.dto';
import { TranscriptDeltaDto } from './dto/transcript_delta.dto';
import { WebrtcSignalDto } from './dto/webrtc_signal.dto';

@WebSocketGateway({ cors: { origin: '*' } })
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (validation_errors) =>
      new WsException(collectValidationMessages(validation_errors).join('; ')),
  }),
)
export class LiveGateway {
  private readonly logger = new Logger(LiveGateway.name);

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join')
  async joinRooms(
    @ConnectedSocket() socket: Socket,
    @MessageBody() join_request: JoinRoomsDto,
  ): Promise<{ joined_rooms: string[] }> {
    const joined_rooms = this.listRoomsToJoin(join_request);
    await socket.join(joined_rooms);
    this.logger.debug(
      `Socket ${socket.id} joined ${joined_rooms.join(', ') || 'no rooms'}`,
    );
    return { joined_rooms };
  }

  @SubscribeMessage('transcript_delta')
  relayTranscriptDelta(
    @MessageBody() transcript_delta: TranscriptDeltaDto,
  ): void {
    this.server.to(STAFF_ROOM).emit(LIVE_EVENT.CALL_TRANSCRIPT_DELTA, {
      call_id: transcript_delta.call_id,
      speaker: transcript_delta.speaker,
      delta: transcript_delta.delta,
      item_id: transcript_delta.item_id ?? null,
    });
  }

  @SubscribeMessage('webrtc_signal')
  relayWebrtcSignal(
    @ConnectedSocket() socket: Socket,
    @MessageBody() webrtc_signal: WebrtcSignalDto,
  ): void {
    const target_room =
      webrtc_signal.sender === 'STAFF'
        ? buildCallRoom(webrtc_signal.call_id)
        : STAFF_ROOM;
    // `socket.to` skips the sender, so a peer never receives its own signal.
    socket.to(target_room).emit(LIVE_EVENT.WEBRTC_SIGNAL, {
      call_id: webrtc_signal.call_id,
      sender: webrtc_signal.sender,
      payload: webrtc_signal.payload,
    });
  }

  private listRoomsToJoin(join_request: JoinRoomsDto): string[] {
    if (join_request.role === 'STAFF') {
      return [STAFF_ROOM];
    }
    const phone_rooms: string[] = [];
    if (join_request.call_id) {
      phone_rooms.push(buildCallRoom(join_request.call_id));
    }
    if (join_request.customer_id) {
      phone_rooms.push(buildCustomerRoom(join_request.customer_id));
    }
    return phone_rooms;
  }
}
