import { Module } from '@nestjs/common';

import { PromptVersionsRepository } from './prompt_versions.repository';
import { PromptsService } from './prompts.service';

@Module({
  providers: [PromptsService, PromptVersionsRepository],
  exports: [PromptsService],
})
export class PromptsModule {}
