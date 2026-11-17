import { IsIn, IsInt, Max, Min } from 'class-validator';

import { MAX_SIMULATED_CALLS } from '../constants/simulator_pacing.constant';
import { SimulatorSpeed } from '../types/simulator_status.type';

export class StartSimulatorDto {
  @IsInt()
  @Min(1)
  @Max(MAX_SIMULATED_CALLS)
  call_count: number;

  @IsIn([1, 2])
  speed: SimulatorSpeed;
}
