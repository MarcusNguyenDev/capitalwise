import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';

import { ParseCallIdPipe } from '../calls/pipes/parse_call_id.pipe';
import { CallTurn } from '../calls/types/call_turn.type';
import { CreateInterventionDto } from './dto/create_intervention.dto';
import { SendStaffMessageDto } from './dto/send_staff_message.dto';
import { InterventionsService } from './interventions.service';
import { InterventionWithStaff } from './types/intervention.type';

@Controller('calls/:call_id')
export class InterventionsController {
  constructor(private readonly interventions_service: InterventionsService) {}

  @Post('interventions')
  createIntervention(
    @Param('call_id', ParseCallIdPipe) call_id: string,
    @Body() create_intervention: CreateInterventionDto,
  ): Promise<InterventionWithStaff> {
    return this.interventions_service.createIntervention(
      call_id,
      create_intervention,
    );
  }

  @Post('interventions/:intervention_id/applied')
  @HttpCode(200)
  async markInstructionApplied(
    @Param('call_id', ParseCallIdPipe) call_id: string,
    @Param('intervention_id') intervention_id: string,
  ): Promise<{
    is_applied: true;
    intervention_id: string;
    turn: CallTurn | null;
  }> {
    const turn = await this.interventions_service.markInstructionApplied(
      call_id,
      intervention_id,
    );
    return { is_applied: true, intervention_id, turn };
  }

  @Post('staff_messages')
  sendStaffMessage(
    @Param('call_id', ParseCallIdPipe) call_id: string,
    @Body() send_staff_message: SendStaffMessageDto,
  ): Promise<CallTurn> {
    return this.interventions_service.sendStaffMessage(
      call_id,
      send_staff_message,
    );
  }
}
