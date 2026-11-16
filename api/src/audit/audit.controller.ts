import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';

import { AuditService } from './audit.service';
import { ListAuditEventsQueryDto } from './dto/list_audit_events_query.dto';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit_service: AuditService) {}

  @Get('events')
  listEvents(@Query() events_query: ListAuditEventsQueryDto) {
    return this.audit_service.listEvents(events_query);
  }

  @Post('tamper_test')
  @HttpCode(HttpStatus.OK)
  runTamperTest() {
    return this.audit_service.runTamperTest();
  }
}
