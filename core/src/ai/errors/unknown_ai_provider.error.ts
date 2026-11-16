import { NotFoundException } from '@nestjs/common';

import { AI_PROVIDER_NAMES } from '../types/ai_provider_name.type';

export class UnknownAiProviderError extends NotFoundException {
  readonly error_code = 'UNKNOWN_AI_PROVIDER';

  constructor(provider_name: string) {
    super(
      `There is no AI provider called "${provider_name}". Use one of: ${AI_PROVIDER_NAMES.join(', ')}.`,
    );
  }
}
