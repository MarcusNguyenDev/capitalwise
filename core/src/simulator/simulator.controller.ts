import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';

import { SetSimulatorSpeedDto } from './dto/set_simulator_speed.dto';
import { StartSimulatorDto } from './dto/start_simulator.dto';
import { SimulatorService } from './simulator.service';
import { SimulatorStatus } from './types/simulator_status.type';

@Controller('simulator')
export class SimulatorController {
  constructor(private readonly simulator_service: SimulatorService) {}

  @Get('status')
  getStatus(): SimulatorStatus {
    return this.simulator_service.getStatus();
  }

  @Post('start')
  @HttpCode(200)
  start(@Body() start_simulator: StartSimulatorDto): Promise<SimulatorStatus> {
    return this.simulator_service.start(start_simulator);
  }

  @Post('stop')
  @HttpCode(200)
  stop(): Promise<SimulatorStatus> {
    return this.simulator_service.stop();
  }

  @Post('speed')
  @HttpCode(200)
  setSpeed(@Body() set_simulator_speed: SetSimulatorSpeedDto): SimulatorStatus {
    return this.simulator_service.setSpeed(set_simulator_speed);
  }
}
