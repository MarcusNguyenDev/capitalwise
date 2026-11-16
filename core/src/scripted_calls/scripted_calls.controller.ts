import { Controller, Get, Param } from '@nestjs/common';

import {
  CallScript,
  CallScriptSummary,
} from '../call_scripts/types/call_script.type';
import { ScriptedCallsService } from './scripted_calls.service';

@Controller('scripted_calls')
export class ScriptedCallsController {
  constructor(private readonly scripted_calls_service: ScriptedCallsService) {}

  @Get()
  listScriptedCalls(): CallScriptSummary[] {
    return this.scripted_calls_service.listScriptedCalls();
  }

  @Get(':customer_id')
  getScriptedCall(@Param('customer_id') customer_id: string): CallScript {
    return this.scripted_calls_service.getScriptedCall(customer_id);
  }
}
