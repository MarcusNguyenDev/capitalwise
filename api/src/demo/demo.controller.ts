import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { DemoService } from './demo.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly demo_service: DemoService) {}

  @Get('config')
  getConfig() {
    return this.demo_service.getConfig();
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  resetDemo() {
    return this.demo_service.resetDemo();
  }
}
