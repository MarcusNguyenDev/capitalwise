import { ServiceUnavailableException } from '@nestjs/common';

export class AiProviderNotConfiguredError extends ServiceUnavailableException {
  readonly error_code = 'AI_PROVIDER_NOT_CONFIGURED';

  constructor(unavailable_reason: string) {
    super(unavailable_reason);
  }
}
