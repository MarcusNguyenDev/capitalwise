import { Injectable } from '@nestjs/common';

import { DashboardRepository } from './dashboard.repository';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboard_repository: DashboardRepository) {}

  getKpis() {
    return this.dashboard_repository.selectKpis();
  }

  listEscalations() {
    return this.dashboard_repository.selectEscalations();
  }
}
