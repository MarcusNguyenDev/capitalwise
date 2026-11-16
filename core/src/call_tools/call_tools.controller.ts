import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';

import { ParseCallIdPipe } from '../calls/pipes/parse_call_id.pipe';
import { CallToolsService } from './call_tools.service';
import { DispatchToolDto } from './dto/dispatch_tool.dto';
import { ToolOutcome } from './types/tool_outcome.type';

@Controller('calls/:call_id/tools')
export class CallToolsController {
  constructor(private readonly call_tools_service: CallToolsService) {}

  @Post(':tool_name')
  @HttpCode(200)
  dispatchTool(
    @Param('call_id', ParseCallIdPipe) call_id: string,
    @Param('tool_name') tool_name: string,
    @Body() dispatch_tool: DispatchToolDto,
  ): Promise<ToolOutcome> {
    return this.call_tools_service.dispatchTool(
      call_id,
      tool_name,
      dispatch_tool.args ?? {},
    );
  }
}
