import { ServiceUnavailableException } from '@nestjs/common';

// The api service could not be reached, timed out or failed with a 5xx.
export class EngineApiUnavailableError extends ServiceUnavailableException {
  readonly error_code = 'ENGINE_API_UNAVAILABLE';

  constructor(request_label: string, failure_reason: string) {
    super(`The api service did not answer ${request_label}: ${failure_reason}`);
  }
}
