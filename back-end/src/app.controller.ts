import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Liveness probe for container healthchecks: GET /api/health.
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
