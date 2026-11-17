import { Module } from '@nestjs/common';

import { CallsModule } from '../calls/calls.module';
import { VoiceAgentModule } from '../voice_agent/voice_agent.module';
import { CustomerMessagesController } from './customer_messages.controller';
import { CustomerMessagesService } from './customer_messages.service';

@Module({
  imports: [CallsModule, VoiceAgentModule],
  controllers: [CustomerMessagesController],
  providers: [CustomerMessagesService],
})
export class CustomerMessagesModule {}
