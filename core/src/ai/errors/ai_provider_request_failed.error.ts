import { BadGatewayException } from '@nestjs/common';

export class AiProviderRequestFailedError extends BadGatewayException {
  readonly error_code = 'AI_PROVIDER_REQUEST_FAILED';
  readonly provider_name: string;

  constructor(provider_name: string, failure_detail: string) {
    super(`The ${provider_name} provider request failed: ${failure_detail}`);
    this.provider_name = provider_name;
  }
}
