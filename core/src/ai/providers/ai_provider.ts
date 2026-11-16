import { CapabilityNotSupportedError } from '../errors/capability_not_supported.error';
import { AiCapability } from '../types/ai_capability.enum';
import { AiProviderName } from '../types/ai_provider_name.type';
import { ResolvedChatRequest } from '../types/chat_request.type';
import { ChatStreamEvent } from '../types/chat_stream_event.type';
import { ProviderHealth } from '../types/provider_health.type';
import {
  ResolvedSpeechRequest,
  SpeechResult,
} from '../types/speech_synthesis.type';
import {
  ResolvedTranscriptionRequest,
  TranscriptionResult,
} from '../types/transcription.type';

// DI token for the registry: a Map<AiProviderName, AiProvider>.
export const AI_PROVIDER_REGISTRY = Symbol('AI_PROVIDER_REGISTRY');

export type AiProviderRegistry = Map<AiProviderName, AiProvider>;

// The shared contract of every AI backend. A provider implements the
// capabilities it lists; the others keep these defaults and refuse.
export abstract class AiProvider {
  abstract readonly provider_name: AiProviderName;
  abstract readonly capabilities: AiCapability[];

  // Whether core/.env has what this provider needs (usually a base URL).
  abstract isConfigured(): boolean;

  // The env key to set when the provider is not configured.
  abstract readonly configuration_hint: string;

  abstract listModels(timeout_ms: number): Promise<string[]>;

  supports(capability: AiCapability): boolean {
    return this.capabilities.includes(capability);
  }

  // For shared base classes that implement more than a subclass offers.
  protected assertSupports(
    capability: AiCapability,
    requested_model: string,
  ): void {
    if (!this.supports(capability)) {
      throw new CapabilityNotSupportedError(
        this.provider_name,
        capability,
        requested_model,
      );
    }
  }

  // A cheap probe: listing the models answers both "is it up" and "is the
  // configured model there". Never throws.
  async checkHealth(timeout_ms: number): Promise<ProviderHealth> {
    if (!this.isConfigured()) {
      return {
        is_reachable: false,
        detail: `${this.provider_name} is not configured. Set ${this.configuration_hint} in core/.env.`,
        models: [],
      };
    }
    try {
      const models = await this.listModels(timeout_ms);
      return {
        is_reachable: true,
        detail: `${this.provider_name} is reachable (${models.length} models).`,
        models,
      };
    } catch (error) {
      return {
        is_reachable: false,
        detail: (error as Error).message,
        models: [],
      };
    }
  }

  async *chat(
    chat_request: ResolvedChatRequest,
  ): AsyncGenerator<ChatStreamEvent> {
    throw new CapabilityNotSupportedError(
      this.provider_name,
      AiCapability.CHAT,
      chat_request.model,
    );
  }

  async transcribe(
    transcription_request: ResolvedTranscriptionRequest,
  ): Promise<TranscriptionResult> {
    throw new CapabilityNotSupportedError(
      this.provider_name,
      AiCapability.TRANSCRIBE,
      transcription_request.model,
    );
  }

  async synthesize(
    speech_request: ResolvedSpeechRequest,
  ): Promise<SpeechResult> {
    throw new CapabilityNotSupportedError(
      this.provider_name,
      AiCapability.SYNTHESIZE,
      speech_request.model,
    );
  }
}
