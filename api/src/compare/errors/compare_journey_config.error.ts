import { InternalServerErrorException } from '@nestjs/common';

export class CompareJourneyConfigError extends InternalServerErrorException {
  readonly error_code = 'COMPARE_JOURNEY_CONFIG';

  constructor(config_path: string) {
    super(`The compare journey config at ${config_path} could not be read.`);
  }
}
