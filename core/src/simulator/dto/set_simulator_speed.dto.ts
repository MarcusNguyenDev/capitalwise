import { IsIn } from 'class-validator';

import { SimulatorSpeed } from '../types/simulator_status.type';

export class SetSimulatorSpeedDto {
  @IsIn([1, 2])
  speed: SimulatorSpeed;
}
