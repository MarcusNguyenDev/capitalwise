import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { ApprovalsService } from './approvals.service';
import { BatchApproveDto } from './dto/batch_approve.dto';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals_service: ApprovalsService) {}

  @Get('inbox')
  listInbox() {
    return this.approvals_service.listInbox();
  }

  @Get('batch_groups')
  listBatchGroups() {
    return this.approvals_service.listBatchGroups();
  }

  @Post('batch_approve')
  @HttpCode(HttpStatus.OK)
  approveBatch(@Body() batch_approval: BatchApproveDto) {
    return this.approvals_service.approveBatch(batch_approval);
  }
}
