import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { DemoService } from './demo.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly demo_service: DemoService) {}

  @Get('config')
  getConfig() {
    return this.demo_service.getConfig();
  }

  // The simulated phone's crib sheet: what this customer would know about
  // themselves. Demo mode only; never used by core or the AI.
  @Get('callers/:customer_id/details')
  getCallerDetails(@Param('customer_id') customer_id: string) {
    return this.demo_service.getCallerDetails(customer_id);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  resetDemo() {
    return this.demo_service.resetDemo();
  }
}
