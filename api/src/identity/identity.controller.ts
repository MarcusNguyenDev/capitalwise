import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { IdentityRecordsService } from '../identity_records/identity_records.service';
import { IdentityCallParamDto } from './dto/identity_call_param.dto';
import { StartIdentityCheckDto } from './dto/start_identity_check.dto';
import { SubmitIdentityAnswersDto } from './dto/submit_identity_answers.dto';
import { IdentityAnswersService } from './identity_answers.service';
import { IdentityChallengesService } from './identity_challenges.service';

// Conversational identity with step-up, called by core on behalf of the AI
// (start_identity_check, submit_identity_answers) and read by the console.
@Controller('identity')
export class IdentityController {
  constructor(
    private readonly identity_challenges_service: IdentityChallengesService,
    private readonly identity_answers_service: IdentityAnswersService,
    private readonly identity_records_service: IdentityRecordsService,
  ) {}

  @Post('challenges')
  startChallenge(@Body() start_request: StartIdentityCheckDto) {
    return this.identity_challenges_service.startChallenge(start_request);
  }

  @Post('challenges/:challenge_id/answers')
  @HttpCode(HttpStatus.OK)
  submitAnswers(
    @Param('challenge_id') challenge_id: string,
    @Body() submission: SubmitIdentityAnswersDto,
  ) {
    return this.identity_answers_service.submitAnswers(
      challenge_id,
      submission,
    );
  }

  @Get('calls/:call_id')
  getCallIdentity(@Param() call_params: IdentityCallParamDto) {
    return this.identity_records_service.getCallIdentity(call_params.call_id);
  }
}
