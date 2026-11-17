import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { aiConfig } from '../config/ai.config';
import { AiProviderNotConfiguredError } from './errors/ai_provider_not_configured.error';
import { CapabilityNotSupportedError } from './errors/capability_not_supported.error';
import { UnknownAiProviderError } from './errors/unknown_ai_provider.error';
import {
  AI_PROVIDER_REGISTRY,
  AiProvider,
  AiProviderRegistry,
} from './providers/ai_provider';
import { AiCapability } from './types/ai_capability.enum';
import {
  AI_PROVIDER_NAMES,
  AiProviderName,
  isAiProviderName,
} from './types/ai_provider_name.type';
import {
  AiStatus,
  CapabilityStatus,
  ProviderStatus,
} from './types/ai_status.type';
import { ChatRequest } from './types/chat_request.type';
import { ChatStreamEvent } from './types/chat_stream_event.type';
import { ProviderHealth } from './types/provider_health.type';
import { SpeechStream } from './types/speech_stream.type';
import {
  ResolvedSpeechRequest,
  SpeechRequest,
  SpeechResult,
} from './types/speech_synthesis.type';
import {
  TranscriptionRequest,
  TranscriptionResult,
} from './types/transcription.type';
import {
  TranscriptionStream,
  TranscriptionStreamRequest,
} from './types/transcription_stream.type';

const HEALTH_CACHE_TTL_MS = 15_000;
const LISTED_MODEL_PREVIEW_COUNT = 6;

const CAPABILITY_LABELS: Record<AiCapability, string> = {
  [AiCapability.CHAT]: 'Chat',
  [AiCapability.TRANSCRIBE]: 'Speech-to-text',
  [AiCapability.SYNTHESIZE]: 'Text-to-speech',
};

const CAPABILITY_ENV_KEYS: Record<AiCapability, string> = {
  [AiCapability.CHAT]: 'AI_CHAT_PROVIDER',
  [AiCapability.TRANSCRIBE]: 'AI_STT_PROVIDER',
  [AiCapability.SYNTHESIZE]: 'AI_TTS_PROVIDER',
};

// Lets the try-it endpoints pick another backend for one request.
export interface AiProviderOverride {
  provider?: string;
}

interface CachedHealth {
  checked_at_ms: number;
  health_promise: Promise<ProviderHealth>;
}

// Ollama treats "name" and "name:latest" as the same model.
function isModelListed(models: string[], model: string): boolean {
  return models.some(
    (listed_model) =>
      listed_model === model || listed_model === `${model}:latest`,
  );
}

// The single entry point to every AI capability. Each capability is routed
// to the provider configured for it; callers never know which backend runs.
@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  // Keyed by provider and server, so one capability's own server
  // (AI_*_BASE_URL) is probed separately.
  private readonly health_cache = new Map<string, CachedHealth>();

  constructor(
    @Inject(AI_PROVIDER_REGISTRY)
    private readonly provider_registry: AiProviderRegistry,
    @Inject(aiConfig.KEY)
    private readonly ai_config: ConfigType<typeof aiConfig>,
  ) {}

  // A wrong provider choice is reported, never fatal: live voice then says
  // why it is unavailable and Scripted mode keeps working.
  onModuleInit(): void {
    for (const capability of Object.values(AiCapability)) {
      const route_problem = this.findRouteProblem(capability);
      if (route_problem) {
        this.logger.error(route_problem);
      } else {
        this.logger.log(
          `${CAPABILITY_LABELS[capability]}: ${this.readConfiguredProviderName(capability)} / ${this.readConfiguredModel(capability)}`,
        );
      }
    }
  }

  chat(
    chat_request: ChatRequest,
    provider_override: AiProviderOverride = {},
  ): AsyncGenerator<ChatStreamEvent> {
    const provider = this.resolveProvider(
      AiCapability.CHAT,
      provider_override.provider,
    );
    const chat_settings = this.ai_config.chat;
    return provider.chat({
      ...chat_request,
      model: chat_request.model || chat_settings.model,
      temperature: chat_request.temperature ?? chat_settings.temperature,
      max_output_tokens:
        chat_request.max_output_tokens ?? chat_settings.max_output_tokens,
      timeout_ms: chat_request.timeout_ms ?? chat_settings.timeout_ms,
      reasoning_effort: chat_settings.reasoning_effort,
      base_url: this.readCapabilityBaseUrl(AiCapability.CHAT, provider),
    });
  }

  async transcribe(
    transcription_request: TranscriptionRequest,
    provider_override: AiProviderOverride = {},
  ): Promise<TranscriptionResult> {
    const provider = this.resolveProvider(
      AiCapability.TRANSCRIBE,
      provider_override.provider,
    );
    const transcribe_settings = this.ai_config.transcribe;
    return provider.transcribe({
      ...transcription_request,
      model: transcription_request.model || transcribe_settings.model,
      language:
        transcription_request.language ??
        (transcribe_settings.language || undefined),
      timeout_ms: transcribe_settings.timeout_ms,
      base_url: this.readCapabilityBaseUrl(AiCapability.TRANSCRIBE, provider),
    });
  }

  async synthesize(
    speech_request: SpeechRequest,
    provider_override: AiProviderOverride = {},
  ): Promise<SpeechResult> {
    const provider = this.resolveProvider(
      AiCapability.SYNTHESIZE,
      provider_override.provider,
    );
    return provider.synthesize(
      this.resolveSpeechRequest(speech_request, provider),
    );
  }

  // Speech as PCM chunks while it is produced (one chunk for providers that
  // only return whole clips).
  synthesizeStream(
    speech_request: SpeechRequest,
    provider_override: AiProviderOverride = {},
  ): SpeechStream {
    const provider = this.resolveProvider(
      AiCapability.SYNTHESIZE,
      provider_override.provider,
    );
    return provider.synthesizeStream(
      this.resolveSpeechRequest(speech_request, provider),
    );
  }

  // Closes the speech connections a call kept open (call ended).
  releaseSpeechSessions(session_key: string): void {
    this.provider_registry.forEach((provider) =>
      provider.releaseSessions(session_key),
    );
  }

  // What a fixed phrase is rendered with, to key the on-disk phrase cache.
  // `server` is part of the route so audio rendered by one server (a fake
  // test server, a self-hosted model, the real API) is never reused as if
  // another server had rendered it.
  describeSpeechRoute(): {
    provider: string;
    server: string;
    model: string;
    speed: number;
    instructions: string;
  } {
    const synthesize_settings = this.ai_config.synthesize;
    const provider_connection =
      this.ai_config.providers[
        synthesize_settings.provider as keyof typeof this.ai_config.providers
      ];
    return {
      provider: synthesize_settings.provider,
      server:
        synthesize_settings.base_url || provider_connection?.base_url || '',
      model: synthesize_settings.model,
      speed: synthesize_settings.speed,
      instructions: synthesize_settings.instructions,
    };
  }

  // A whole call's speech-to-text: audio in while the caller talks, one
  // commit per turn.
  openTranscriptionStream(
    stream_request: TranscriptionStreamRequest = {},
    provider_override: AiProviderOverride = {},
  ): TranscriptionStream {
    const provider = this.resolveProvider(
      AiCapability.TRANSCRIBE,
      provider_override.provider,
    );
    const transcribe_settings = this.ai_config.transcribe;
    return provider.openTranscriptionStream({
      ...stream_request,
      model: stream_request.model || transcribe_settings.model,
      language:
        stream_request.language ?? (transcribe_settings.language || undefined),
      timeout_ms: transcribe_settings.timeout_ms,
      base_url: this.readCapabilityBaseUrl(AiCapability.TRANSCRIBE, provider),
    });
  }

  private resolveSpeechRequest(
    speech_request: SpeechRequest,
    provider: AiProvider,
  ): ResolvedSpeechRequest {
    const synthesize_settings = this.ai_config.synthesize;
    return {
      ...speech_request,
      model: speech_request.model || synthesize_settings.model,
      voice: speech_request.voice || synthesize_settings.ai_voice,
      speed: speech_request.speed ?? synthesize_settings.speed,
      instructions:
        speech_request.instructions ??
        (synthesize_settings.instructions || undefined),
      timeout_ms: synthesize_settings.timeout_ms,
      base_url: this.readCapabilityBaseUrl(AiCapability.SYNTHESIZE, provider),
    };
  }

  async listModels(provider_name: string): Promise<string[]> {
    const provider = this.getProvider(provider_name);
    if (!provider.isConfigured()) {
      throw new AiProviderNotConfiguredError(
        `The ${provider.provider_name} provider is not configured. Set ${provider.configuration_hint} in core/.env.`,
      );
    }
    return provider.listModels(this.ai_config.health_check_timeout_ms);
  }

  // Probes are cached for 15 s, so status polling never hammers a backend.
  async getStatus(): Promise<AiStatus> {
    const [chat, transcribe, synthesize] = await Promise.all([
      this.buildCapabilityStatus(AiCapability.CHAT),
      this.buildCapabilityStatus(AiCapability.TRANSCRIBE),
      this.buildCapabilityStatus(AiCapability.SYNTHESIZE),
    ]);
    return {
      capabilities: {
        chat,
        transcribe,
        synthesize: {
          ...synthesize,
          voice: this.ai_config.synthesize.ai_voice,
          staff_voice: this.ai_config.synthesize.staff_voice,
        },
      },
      providers: this.buildProviderStatuses(),
      checked_at: new Date().toISOString(),
    };
  }

  readConfiguredProviderName(capability: AiCapability): string {
    if (capability === AiCapability.CHAT) {
      return this.ai_config.chat.provider;
    }
    return capability === AiCapability.TRANSCRIBE
      ? this.ai_config.transcribe.provider
      : this.ai_config.synthesize.provider;
  }

  readConfiguredModel(capability: AiCapability): string {
    if (capability === AiCapability.CHAT) {
      return this.ai_config.chat.model;
    }
    return capability === AiCapability.TRANSCRIBE
      ? this.ai_config.transcribe.model
      : this.ai_config.synthesize.model;
  }

  private getProvider(provider_name: string): AiProvider {
    const normalised_name = provider_name.trim().toLowerCase();
    const provider = isAiProviderName(normalised_name)
      ? this.provider_registry.get(normalised_name)
      : undefined;
    if (!provider) {
      throw new UnknownAiProviderError(provider_name);
    }
    return provider;
  }

  // AI_CHAT_BASE_URL / AI_STT_BASE_URL / AI_TTS_BASE_URL: a capability's own
  // server. It applies only to the provider configured for that capability
  // (a try-it request that picks another provider uses that provider's URL).
  private readCapabilityBaseUrl(
    capability: AiCapability,
    provider: AiProvider,
  ): string | undefined {
    if (
      provider.provider_name !== this.readConfiguredProviderName(capability)
    ) {
      return undefined;
    }
    const capability_base_url =
      capability === AiCapability.CHAT
        ? this.ai_config.chat.base_url
        : capability === AiCapability.TRANSCRIBE
          ? this.ai_config.transcribe.base_url
          : this.ai_config.synthesize.base_url;
    return capability_base_url || undefined;
  }

  private resolveProvider(
    capability: AiCapability,
    provider_name_override?: string,
  ): AiProvider {
    const provider = this.getProvider(
      provider_name_override || this.readConfiguredProviderName(capability),
    );
    if (!provider.supports(capability)) {
      throw new CapabilityNotSupportedError(provider.provider_name, capability);
    }
    if (
      !provider.isConfigured() &&
      !this.readCapabilityBaseUrl(capability, provider)
    ) {
      throw new AiProviderNotConfiguredError(
        `${CAPABILITY_LABELS[capability]} provider ${provider.provider_name} is not configured. Set ${provider.configuration_hint} in core/.env.`,
      );
    }
    return provider;
  }

  // Null when the configured route can work (reachability aside).
  private findRouteProblem(capability: AiCapability): string | null {
    const provider_name = this.readConfiguredProviderName(capability);
    const label = CAPABILITY_LABELS[capability];
    const provider = isAiProviderName(provider_name)
      ? this.provider_registry.get(provider_name)
      : undefined;
    if (!provider) {
      return `${label} provider "${provider_name}" is unknown. Set ${CAPABILITY_ENV_KEYS[capability]} to one of: ${AI_PROVIDER_NAMES.join(', ')}.`;
    }
    if (!provider.supports(capability)) {
      return `${label} provider ${provider_name} does not support ${capability}. Choose another ${CAPABILITY_ENV_KEYS[capability]}.`;
    }
    if (
      !provider.isConfigured() &&
      !this.readCapabilityBaseUrl(capability, provider)
    ) {
      return `${label} provider ${provider_name} is not configured. Set ${provider.configuration_hint} in core/.env.`;
    }
    return null;
  }

  private async buildCapabilityStatus(
    capability: AiCapability,
  ): Promise<CapabilityStatus> {
    const provider_name = this.readConfiguredProviderName(capability);
    const model = this.readConfiguredModel(capability);
    const route_problem = this.findRouteProblem(capability);
    if (route_problem) {
      return {
        provider: provider_name,
        model,
        is_reachable: false,
        detail: route_problem,
      };
    }
    const provider_health = await this.checkProviderHealth(
      provider_name as AiProviderName,
      this.readCapabilityBaseUrl(
        capability,
        this.provider_registry.get(
          provider_name as AiProviderName,
        ) as AiProvider,
      ),
    );
    return {
      provider: provider_name,
      model,
      ...this.describeHealth(capability, provider_health, model),
    };
  }

  private describeHealth(
    capability: AiCapability,
    provider_health: ProviderHealth,
    model: string,
  ): Pick<CapabilityStatus, 'is_reachable' | 'detail'> {
    const label = CAPABILITY_LABELS[capability];
    const provider_name = this.readConfiguredProviderName(capability);
    if (!provider_health.is_reachable) {
      return {
        is_reachable: false,
        detail: `${label} provider ${provider_name} is not reachable: ${provider_health.detail}`,
      };
    }
    if (!isModelListed(provider_health.models, model)) {
      const listed_models = provider_health.models
        .slice(0, LISTED_MODEL_PREVIEW_COUNT)
        .join(', ');
      return {
        is_reachable: false,
        detail: `${label} model ${model} is not available on ${provider_name} (it lists: ${listed_models || 'no models'}).`,
      };
    }
    return { is_reachable: true, detail: provider_health.detail };
  }

  private checkProviderHealth(
    provider_name: AiProviderName,
    base_url: string | undefined,
  ): Promise<ProviderHealth> {
    const cache_key = `${provider_name} ${base_url ?? ''}`;
    const cached_health = this.health_cache.get(cache_key);
    if (
      cached_health &&
      Date.now() - cached_health.checked_at_ms < HEALTH_CACHE_TTL_MS
    ) {
      return cached_health.health_promise;
    }
    const provider = this.provider_registry.get(provider_name) as AiProvider;
    const health_promise = provider.checkHealth(
      this.ai_config.health_check_timeout_ms,
      base_url,
    );
    this.health_cache.set(cache_key, {
      checked_at_ms: Date.now(),
      health_promise,
    });
    return health_promise;
  }

  private buildProviderStatuses(): Record<AiProviderName, ProviderStatus> {
    const provider_statuses = {} as Record<AiProviderName, ProviderStatus>;
    for (const [provider_name, provider] of this.provider_registry) {
      provider_statuses[provider_name] = {
        capabilities: provider.capabilities,
        is_configured: provider.isConfigured(),
      };
    }
    return provider_statuses;
  }
}
