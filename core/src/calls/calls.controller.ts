import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';

import { CallsService } from './calls.service';
import { AddTurnDto } from './dto/add_turn.dto';
import { CreateCallDto } from './dto/create_call.dto';
import { EndCallDto } from './dto/end_call.dto';
import { RecordMetricsDto } from './dto/record_metrics.dto';
import { ParseCallIdPipe } from './pipes/parse_call_id.pipe';
import { CallDetail } from './types/call_detail.type';
import { CallTurn } from './types/call_turn.type';
import { LiveCall } from './types/live_call.type';

@Controller('calls')
export class CallsController {
  constructor(private readonly calls_service: CallsService) {}

  @Get()
  listLiveCalls(): Promise<LiveCall[]> {
    return this.calls_service.listLiveCalls();
  }

  @Post()
  createCall(@Body() create_call: CreateCallDto): Promise<LiveCall> {
    return this.calls_service.createCall(create_call);
  }

  @Get(':call_id')
  getCallDetail(
    @Param('call_id', ParseCallIdPipe) call_id: string,
  ): Promise<CallDetail> {
    return this.calls_service.getCallDetail(call_id);
  }

  @Post(':call_id/turns')
  addTurn(
    @Param('call_id', ParseCallIdPipe) call_id: string,
    @Body() add_turn: AddTurnDto,
  ): Promise<CallTurn> {
    return this.calls_service.addTurn(call_id, add_turn);
  }

  @Post(':call_id/metrics')
  @HttpCode(200)
  recordMetrics(
    @Param('call_id', ParseCallIdPipe) call_id: string,
    @Body() record_metrics: RecordMetricsDto,
  ): Promise<LiveCall> {
    return this.calls_service.recordMetrics(call_id, record_metrics);
  }

  @Post(':call_id/end')
  @HttpCode(200)
  endCall(
    @Param('call_id', ParseCallIdPipe) call_id: string,
    @Body() end_call: EndCallDto,
  ): Promise<LiveCall> {
    return this.calls_service.endCall(call_id, end_call);
  }
}
