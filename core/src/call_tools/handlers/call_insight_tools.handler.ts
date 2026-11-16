import { Injectable } from '@nestjs/common';

import { CallsService } from '../../calls/calls.service';
import { CallChanges } from '../../calls/types/call_row.type';
import { UpdateCallInsightArgsDto } from '../dto/update_call_insight_args.dto';
import { ToolContext } from '../types/tool_context.type';

@Injectable()
export class CallInsightToolsHandler {
  constructor(private readonly calls_service: CallsService) {}

  async updateCallInsight(
    tool_context: ToolContext,
    tool_args: UpdateCallInsightArgsDto,
  ): Promise<Record<string, unknown>> {
    const call_changes: CallChanges = {};
    if (tool_args.intent !== undefined) {
      call_changes.intent = tool_args.intent;
    }
    if (tool_args.sentiment !== undefined) {
      call_changes.sentiment = tool_args.sentiment;
    }
    if (tool_args.summary !== undefined) {
      call_changes.ai_summary = tool_args.summary;
    }
    await this.calls_service.changeCall(
      tool_context.call.call_id,
      this.calls_service.buildAgentActor(tool_context.call),
      () => call_changes,
    );
    return { updated: true };
  }
}
