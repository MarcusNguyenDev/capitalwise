import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { ConcernsService } from './concerns.service';
import { DecisionsService } from './decisions.service';
import { FlagConcernDto } from './dto/flag_concern.dto';
import { HumanJoinedDto } from './dto/human_joined.dto';
import { ProposeActionDto } from './dto/propose_action.dto';
import { ProposalsService } from './proposals.service';

// Called by the core service on behalf of the AI specialist.
@Controller('actions')
export class ActionsController {
  constructor(
    private readonly proposals_service: ProposalsService,
    private readonly concerns_service: ConcernsService,
    private readonly decisions_service: DecisionsService,
  ) {}

  @Post('propose')
  @HttpCode(HttpStatus.OK)
  proposeAction(@Body() proposal: ProposeActionDto) {
    return this.proposals_service.proposeAction(proposal);
  }

  @Post('flag_concern')
  @HttpCode(HttpStatus.OK)
  flagConcern(@Body() concern: FlagConcernDto) {
    return this.concerns_service.flagConcern(concern);
  }

  @Post('human_joined')
  @HttpCode(HttpStatus.OK)
  async closeHandoverCases(@Body() human_joined: HumanJoinedDto) {
    const closed_case_numbers = await this.decisions_service.closeHandoverCases(
      human_joined.call_id,
      human_joined.staff_id,
    );
    return { closed_case_numbers };
  }
}
