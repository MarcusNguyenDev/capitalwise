import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';

import { ParseCallIdPipe } from '../calls/pipes/parse_call_id.pipe';
import { CustomerMessagesService } from './customer_messages.service';
import { SendCustomerMessageDto } from './dto/send_customer_message.dto';
import { CustomerMessageReceipt } from './types/customer_message_receipt.type';

@Controller('calls/:call_id')
export class CustomerMessagesController {
  constructor(
    private readonly customer_messages_service: CustomerMessagesService,
  ) {}

  // 202: the agent records and answers the line in the background.
  @Post('customer_messages')
  @HttpCode(202)
  sendCustomerMessage(
    @Param('call_id', ParseCallIdPipe) call_id: string,
    @Body() send_customer_message: SendCustomerMessageDto,
  ): Promise<CustomerMessageReceipt> {
    return this.customer_messages_service.sendCustomerMessage(
      call_id,
      send_customer_message,
    );
  }
}
