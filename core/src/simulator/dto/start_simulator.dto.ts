import { IsIn, IsInt, Max, Min } from 'class-validator';

import { SimulatorSpeed } from '../types/simulator_status.type';

export class StartSimulatorDto {
  @IsInt()
  @Min(1)
  @Max(6)
  call_count: number;

  @IsIn([1, 2])
  speed: SimulatorSpeed;
}
