import { Injectable } from '@nestjs/common';

import { CallsService } from '../calls/calls.service';
import { VoiceAgentSessionManager } from '../voice_agent/voice_agent_session.manager';
import { SendCustomerMessageDto } from './dto/send_customer_message.dto';
import { CallNotLiveError } from './errors/call_not_live.error';
import { VoiceAgentNotRunningError } from './errors/voice_agent_not_running.error';
import { CustomerMessageReceipt } from './types/customer_message_receipt.type';

// What the caller types on the phone instead of speaking (no microphone, a
// noisy room). It goes to the call's voice agent, which treats it as a
// transcribed utterance.
@Injectable()
export class CustomerMessagesService {
  constructor(
    private readonly calls_service: CallsService,
    private readonly voice_agent_session_manager: VoiceAgentSessionManager,
  ) {}

  async sendCustomerMessage(
    call_id: string,
    send_customer_message: SendCustomerMessageDto,
  ): Promise<CustomerMessageReceipt> {
    const call = await this.calls_service.getActiveCall(call_id);
    if (call.metrics.mode !== 'LIVE') {
      throw new CallNotLiveError(call_id);
    }
    const is_accepted =
      this.voice_agent_session_manager.acceptTypedCustomerMessage(
        call_id,
        send_customer_message.text.trim(),
      );
    if (!is_accepted) {
      throw new VoiceAgentNotRunningError(call_id);
    }
    return { is_accepted: true };
  }
}
