import { Controller, Get } from '@nestjs/common';

import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard_service: DashboardService) {}

  @Get('kpis')
  getKpis() {
    return this.dashboard_service.getKpis();
  }

  @Get('escalations')
  listEscalations() {
    return this.dashboard_service.listEscalations();
  }
}
