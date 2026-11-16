import { BadRequestException } from '@nestjs/common';

export class InvalidAudioError extends BadRequestException {
  readonly error_code = 'INVALID_AUDIO';

  constructor(problem: string) {
    super(`The audio is not a usable WAV file: ${problem}.`);
  }
}
