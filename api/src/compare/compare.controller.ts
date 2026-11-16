import { Controller, Get } from '@nestjs/common';

import { CompareService } from './compare.service';

@Controller('compare')
export class CompareController {
  constructor(private readonly compare_service: CompareService) {}

  @Get()
  getComparison() {
    return this.compare_service.getComparison();
  }
}
