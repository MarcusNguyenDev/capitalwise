import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { appConfig } from '../config/app.config';
import { contentConfig } from '../config/content.config';
import { PromptVersionsRepository } from './prompt_versions.repository';
import { renderPrompt } from './render_prompt.util';

const VOICE_AGENT_PROMPT_FILE = 'voice_agent.md';
const FILE_PROMPT_VERSION = 'file';

export interface VoiceAgentInstructions {
  prompt_version: string;
  instructions: string;
}

@Injectable()
export class PromptsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PromptsService.name);

  constructor(
    private readonly prompt_versions_repository: PromptVersionsRepository,
    @Inject(appConfig.KEY)
    private readonly app_config: ConfigType<typeof appConfig>,
    @Inject(contentConfig.KEY)
    private readonly content_config: ConfigType<typeof contentConfig>,
  ) {}

  // The database row is what runs; the file in git is the reviewed source.
  // Drift between the two is reported, never fatal.
  async onApplicationBootstrap(): Promise<void> {
    try {
      const active_prompt = await this.prompt_versions_repository.findActive();
      const file_prompt = await this.readPromptFile();
      if (
        active_prompt &&
        active_prompt.content.trim() !== file_prompt.trim()
      ) {
        this.logger.warn(
          `Active prompt version ${active_prompt.version} in the database differs from prompts/${VOICE_AGENT_PROMPT_FILE}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not compare the prompt file with the database: ${(error as Error).message}`,
      );
    }
  }

  async getVoiceAgentInstructions(): Promise<VoiceAgentInstructions> {
    const active_prompt = await this.prompt_versions_repository.findActive();
    if (active_prompt) {
      return {
        prompt_version: active_prompt.version,
        instructions: renderPrompt(
          active_prompt.content,
          this.app_config.bank_name,
        ),
      };
    }
    this.logger.warn(
      'No active prompt version in the database; using the file',
    );
    return {
      prompt_version: FILE_PROMPT_VERSION,
      instructions: renderPrompt(
        await this.readPromptFile(),
        this.app_config.bank_name,
      ),
    };
  }

  private readPromptFile(): Promise<string> {
    return readFile(
      join(this.content_config.prompts_dir, VOICE_AGENT_PROMPT_FILE),
      'utf8',
    );
  }
}
