import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { aiConfig } from '../config/ai.config';
import { appConfig } from '../config/app.config';
import { listHoldPhrases } from '../hold_buffer/constants/hold_phrases.constant';
import { PhraseAudioCache } from '../hold_buffer/phrase_audio.cache';
import { LIVE_EVENT } from '../live/constants/live_event_names.constant';
import { LiveEventBus } from '../live/live_event_bus.service';
import { AiAgentsRepository } from './ai_agents.repository';
import { listAgentPhrases } from './constants/agent_phrases.constant';

// The reseed of a demo reset finishes before the event is published, but
// give the api a moment to finish its own reset work.
const AFTER_RESET_DELAY_MS = 1_000;

// At startup (and after a demo reset): record the real chat model on every
// AI agent, and pre-render the fixed phrases in both voices so the greeting
// and hold lines start instantly. Neither step may stop core from starting.
@Injectable()
export class VoiceAgentBootstrapService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(VoiceAgentBootstrapService.name);
  private unsubscribeFromReset: (() => void) | null = null;
  private reset_timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly ai_agents_repository: AiAgentsRepository,
    private readonly phrase_audio_cache: PhraseAudioCache,
    private readonly live_event_bus: LiveEventBus,
    @Inject(appConfig.KEY)
    private readonly app_config: ConfigType<typeof appConfig>,
    @Inject(aiConfig.KEY)
    private readonly ai_config: ConfigType<typeof aiConfig>,
  ) {}

  onApplicationBootstrap(): void {
    void this.recordAgentModel();
    void this.prerenderPhrases();
    this.unsubscribeFromReset = this.live_event_bus.subscribe(
      LIVE_EVENT.DEMO_RESET,
      () => {
        this.reset_timer = setTimeout(
          () => void this.recordAgentModel(),
          AFTER_RESET_DELAY_MS,
        );
      },
    );
  }

  onModuleDestroy(): void {
    this.unsubscribeFromReset?.();
    if (this.reset_timer) {
      clearTimeout(this.reset_timer);
    }
  }

  private async recordAgentModel(): Promise<void> {
    const model_label = `${this.ai_config.chat.provider}/${this.ai_config.chat.model}`;
    try {
      const updated_count =
        await this.ai_agents_repository.updateModelOfAllAgents(model_label);
      this.logger.log(
        `AI agents run ${model_label} (${updated_count} rows updated)`,
      );
    } catch (error) {
      this.logger.warn(
        `Could not record the model on the AI agents: ${(error as Error).message}`,
      );
    }
  }

  private async prerenderPhrases(): Promise<void> {
    const started_at_ms = Date.now();
    const prerender_outcome = await this.phrase_audio_cache.prerenderPhrases(
      [...listAgentPhrases(this.app_config.bank_name), ...listHoldPhrases()],
      [
        this.ai_config.synthesize.ai_voice,
        this.ai_config.synthesize.staff_voice,
      ],
    );
    this.logger.log(
      `Pre-rendered ${prerender_outcome.rendered_count} phrases in ${Date.now() - started_at_ms} ms (${prerender_outcome.failed_count} failed, retried when needed)`,
    );
  }
}
