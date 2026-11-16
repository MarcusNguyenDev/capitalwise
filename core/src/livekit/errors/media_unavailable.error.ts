import { ServiceUnavailableException } from '@nestjs/common';

export class MediaUnavailableError extends ServiceUnavailableException {
  readonly error_code = 'MEDIA_UNAVAILABLE';

  constructor(unavailable_reason: string) {
    super(`Call audio (LiveKit) is unavailable: ${unavailable_reason}`);
  }
}
