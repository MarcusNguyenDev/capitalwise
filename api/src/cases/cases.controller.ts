import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { CasesService } from './cases.service';
import { DecisionsService } from './decisions.service';
import { DecideCaseDto } from './dto/decide_case.dto';
import { ListCasesQueryDto } from './dto/list_cases_query.dto';

@Controller('cases')
export class CasesController {
  constructor(
    private readonly cases_service: CasesService,
    private readonly decisions_service: DecisionsService,
  ) {}

  @Get()
  listCases(@Query() cases_query: ListCasesQueryDto) {
    return this.cases_service.listCases(cases_query);
  }

  @Get(':case_number')
  getCasePack(@Param('case_number') case_number: string) {
    return this.cases_service.getCasePack(case_number);
  }

  @Post(':case_number/decision')
  @HttpCode(HttpStatus.OK)
  decideCase(
    @Param('case_number') case_number: string,
    @Body() case_decision: DecideCaseDto,
  ) {
    return this.decisions_service.decideCase(case_number, case_decision);
  }
}
