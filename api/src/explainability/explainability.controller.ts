import { Controller, Get, Param, Query } from '@nestjs/common';

import { CallIdParamDto } from './dto/call_id_param.dto';
import { ListCallsQueryDto } from './dto/list_calls_query.dto';
import { ExplainabilityService } from './explainability.service';

@Controller('explanations')
export class ExplainabilityController {
  constructor(private readonly explainability_service: ExplainabilityService) {}

  @Get('cases/:case_number')
  explainCase(@Param('case_number') case_number: string) {
    return this.explainability_service.explainCase(case_number);
  }

  @Get('calls')
  listCalls(@Query() calls_query: ListCallsQueryDto) {
    return this.explainability_service.listCalls(calls_query);
  }

  @Get('calls/:call_id/timeline')
  getCallTimeline(@Param() call_params: CallIdParamDto) {
    return this.explainability_service.getCallTimeline(call_params.call_id);
  }
}
