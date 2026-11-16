import { BadRequestException } from '@nestjs/common';

export class AudioFileRequiredError extends BadRequestException {
  readonly error_code = 'AUDIO_FILE_REQUIRED';

  constructor() {
    super('Send the audio as a multipart form field called "file" (a WAV).');
  }
}
