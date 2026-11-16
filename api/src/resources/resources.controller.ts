import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { AutonomyService } from './autonomy.service';
import { CreateAutonomyProposalDto } from './dto/create_autonomy_proposal.dto';
import { SignOffAutonomyProposalDto } from './dto/sign_off_autonomy_proposal.dto';
import { UpdateStaffStatusDto } from './dto/update_staff_status.dto';
import { WorkforceService } from './workforce.service';

@Controller('resources')
export class ResourcesController {
  constructor(
    private readonly workforce_service: WorkforceService,
    private readonly autonomy_service: AutonomyService,
  ) {}

  @Get('workforce')
  getWorkforce() {
    return this.workforce_service.getWorkforce();
  }

  @Patch('staff/:staff_id/status')
  updateStaffStatus(
    @Param('staff_id') staff_id: string,
    @Body() status_update: UpdateStaffStatusDto,
  ) {
    return this.workforce_service.updateStaffStatus(
      staff_id,
      status_update.status,
    );
  }

  @Get('routing')
  getRouting() {
    return this.workforce_service.getRouting();
  }

  @Get('registry')
  getRegistry() {
    return this.workforce_service.getRegistry();
  }

  @Get('prompt_versions')
  listPromptVersions() {
    return this.workforce_service.listPromptVersions();
  }

  @Get('autonomy')
  getAutonomy() {
    return this.autonomy_service.getAutonomy();
  }

  @Post('autonomy/proposals')
  createProposal(@Body() new_proposal: CreateAutonomyProposalDto) {
    return this.autonomy_service.createProposal(new_proposal);
  }

  @Post('autonomy/proposals/:proposal_id/sign_off')
  @HttpCode(HttpStatus.OK)
  signOffProposal(
    @Param('proposal_id', ParseIntPipe) proposal_id: number,
    @Body() sign_off: SignOffAutonomyProposalDto,
  ) {
    return this.autonomy_service.signOffProposal(
      proposal_id,
      sign_off.staff_id,
    );
  }
}
