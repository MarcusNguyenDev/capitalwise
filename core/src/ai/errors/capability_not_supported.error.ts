import { BadRequestException } from '@nestjs/common';

import { AiCapability } from '../types/ai_capability.enum';

export class CapabilityNotSupportedError extends BadRequestException {
  readonly error_code = 'AI_CAPABILITY_NOT_SUPPORTED';

  constructor(
    provider_name: string,
    capability: AiCapability,
    requested_model?: string,
  ) {
    super(
      `The ${provider_name} provider does not support ${capability}${requested_model ? ` (asked for model ${requested_model})` : ''}.`,
    );
  }
}
