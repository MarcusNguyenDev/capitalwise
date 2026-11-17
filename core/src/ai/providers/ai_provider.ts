import { CapabilityNotSupportedError } from '../errors/capability_not_supported.error';
import { AiCapability } from '../types/ai_capability.enum';
import { AiProviderName } from '../types/ai_provider_name.type';
import { ResolvedChatRequest } from '../types/chat_request.type';
import { ChatStreamEvent } from '../types/chat_stream_event.type';
import { ProviderHealth } from '../types/provider_health.type';
import { SpeechStream } from '../types/speech_stream.type';
import {
  ResolvedSpeechRequest,
  SpeechResult,
} from '../types/speech_synthesis.type';
import {
  ResolvedTranscriptionRequest,
  TranscriptionResult,
} from '../types/transcription.type';
import {
  ResolvedTranscriptionStreamRequest,
  TranscriptionStream,
} from '../types/transcription_stream.type';
import { BufferedTranscriptionStream } from '../wire/buffered_transcription.stream';
import { createSingleChunkSpeechStream } from '../wire/single_chunk_speech.stream';

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

  // `base_url` probes a capability's own server (AI_*_BASE_URL) instead.
  abstract listModels(timeout_ms: number, base_url?: string): Promise<string[]>;

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
  async checkHealth(
    timeout_ms: number,
    base_url?: string,
  ): Promise<ProviderHealth> {
    if (!base_url && !this.isConfigured()) {
      return {
        is_reachable: false,
        detail: `${this.provider_name} is not configured. Set ${this.configuration_hint} in core/.env.`,
        models: [],
      };
    }
    try {
      const models = await this.listModels(timeout_ms, base_url);
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

  // A whole call's speech-to-text. By default each committed turn is sent as
  // one file to transcribe(); streaming providers override this.
  openTranscriptionStream(
    stream_request: ResolvedTranscriptionStreamRequest,
  ): TranscriptionStream {
    this.assertSupports(AiCapability.TRANSCRIBE, stream_request.model);
    return new BufferedTranscriptionStream((wav) =>
      this.transcribe({
        audio: wav,
        model: stream_request.model,
        language: stream_request.language,
        prompt: stream_request.prompt,
        timeout_ms: stream_request.timeout_ms,
        base_url: stream_request.base_url,
      }),
    );
  }

  // Closes any connection kept open for a call (see SpeechRequest.session_key).
  // Only connection-based providers keep any; the others have nothing to close.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  releaseSessions(session_key: string): void {
    return undefined;
  }

  // Speech as chunks while it is produced. By default one chunk once
  // synthesize() is done; streaming providers override this.
  synthesizeStream(speech_request: ResolvedSpeechRequest): SpeechStream {
    return createSingleChunkSpeechStream(
      this.synthesize(speech_request),
      speech_request.text,
    );
  }
}
