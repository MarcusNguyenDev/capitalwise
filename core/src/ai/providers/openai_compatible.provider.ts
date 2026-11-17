import { AiCapability } from '../types/ai_capability.enum';
import { ChatMessage, ResolvedChatRequest } from '../types/chat_request.type';
import { ChatStreamEvent } from '../types/chat_stream_event.type';
import { ProviderConnection } from '../types/provider_connection.type';
import {
  ResolvedSpeechRequest,
  SpeechResult,
} from '../types/speech_synthesis.type';
import {
  ResolvedTranscriptionRequest,
  TranscriptionResult,
} from '../types/transcription.type';
import { decodeOpenAiChatStream } from '../wire/decode_openai_chat_stream.util';
import { readPcmSampleRate } from '../wire/read_pcm_sample_rate.util';
import {
  decodeSpeechAudio,
  measureWavDurationSeconds,
} from '../wire/decode_speech_audio.util';
import { IdleWatchdog } from '../wire/idle.watchdog';
import { readSseData } from '../wire/read_sse_data.util';
import {
  mapProviderFetchError,
  sendProviderRequest,
} from '../wire/send_provider_request.util';
import { AiProvider } from './ai_provider';

function mapMessageToWire(chat_message: ChatMessage): Record<string, unknown> {
  if (chat_message.role === 'assistant') {
    const tool_calls = chat_message.tool_calls ?? [];
    return {
      role: 'assistant',
      content:
        chat_message.content === '' && tool_calls.length > 0
          ? null
          : chat_message.content,
      ...(tool_calls.length > 0
        ? {
            tool_calls: tool_calls.map((tool_call) => ({
              id: tool_call.tool_call_id,
              type: 'function',
              function: {
                name: tool_call.name,
                arguments: JSON.stringify(tool_call.arguments),
              },
            })),
          }
        : {}),
    };
  }
  if (chat_message.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: chat_message.tool_call_id,
      name: chat_message.name,
      content: chat_message.content,
    };
  }
  return { role: chat_message.role, content: chat_message.content };
}

// Shared base for OpenAI-style HTTP APIs (/chat/completions with SSE,
// /audio/transcriptions, /audio/speech, /models). Not registered on its own:
// vLLM, OpenAI and Speaches extend it and say which capabilities they offer.
export abstract class OpenAiCompatibleProvider extends AiProvider {
  constructor(protected readonly connection: ProviderConnection) {
    super();
  }

  isConfigured(): boolean {
    return this.connection.base_url.length > 0;
  }

  async listModels(timeout_ms: number, base_url?: string): Promise<string[]> {
    const response = await sendProviderRequest({
      provider_name: this.provider_name,
      url: `${this.resolveBaseUrl(base_url)}/models`,
      method: 'GET',
      api_key: this.connection.api_key,
      timeout_ms,
    });
    const models_body = (await response.json()) as {
      data?: { id?: string }[];
    };
    return (models_body.data ?? [])
      .map((model_entry) => model_entry.id ?? '')
      .filter((model_id) => model_id.length > 0);
  }

  async *chat(
    chat_request: ResolvedChatRequest,
  ): AsyncGenerator<ChatStreamEvent> {
    this.assertSupports(AiCapability.CHAT, chat_request.model);
    const chat_url = `${this.resolveBaseUrl(chat_request.base_url)}/chat/completions`;
    const idle_watchdog = new IdleWatchdog(chat_request.timeout_ms);
    const response = await sendProviderRequest({
      provider_name: this.provider_name,
      url: chat_url,
      method: 'POST',
      api_key: this.connection.api_key,
      json_body: this.buildChatBody(chat_request),
      timeout_ms: chat_request.timeout_ms,
      idle_watchdog,
      abort_signal: chat_request.abort_signal,
    }).catch((error: unknown) => {
      idle_watchdog.stop();
      throw error;
    });
    try {
      yield* decodeOpenAiChatStream(
        readSseData(response.body as ReadableStream<Uint8Array>, () =>
          idle_watchdog.restart(),
        ),
      );
    } catch (error) {
      throw mapProviderFetchError(
        {
          provider_name: this.provider_name,
          url: chat_url,
          timeout_ms: chat_request.timeout_ms,
          abort_signal: chat_request.abort_signal,
        },
        error,
      );
    } finally {
      idle_watchdog.stop();
    }
  }

  async transcribe(
    transcription_request: ResolvedTranscriptionRequest,
  ): Promise<TranscriptionResult> {
    this.assertSupports(AiCapability.TRANSCRIBE, transcription_request.model);
    const response = await sendProviderRequest({
      provider_name: this.provider_name,
      url: `${this.resolveBaseUrl(transcription_request.base_url)}/audio/transcriptions`,
      method: 'POST',
      api_key: this.connection.api_key,
      form_body: this.buildTranscriptionForm(transcription_request),
      timeout_ms: transcription_request.timeout_ms,
      abort_signal: transcription_request.abort_signal,
    });
    const transcription_body = (await response.json()) as { text?: string };
    return {
      text: (transcription_body.text ?? '').trim(),
      duration_seconds: measureWavDurationSeconds(transcription_request.audio),
      provider: this.provider_name,
      model: transcription_request.model,
    };
  }

  async synthesize(
    speech_request: ResolvedSpeechRequest,
  ): Promise<SpeechResult> {
    this.assertSupports(AiCapability.SYNTHESIZE, speech_request.model);
    const response = await this.requestSpeech(speech_request);
    const decoded_audio = decodeSpeechAudio(
      Buffer.from(await response.arrayBuffer()),
      speech_request.sample_rate,
      readPcmSampleRate(response),
    );
    return {
      pcm: decoded_audio.pcm,
      sample_rate: decoded_audio.sample_rate,
      provider: this.provider_name,
      model: speech_request.model,
      voice: speech_request.voice,
    };
  }

  // Whether `instructions` (tone guidance) may be sent to /audio/speech.
  protected readonly supports_speech_instructions: boolean = false;

  protected resolveBaseUrl(base_url_override?: string): string {
    return base_url_override || this.connection.base_url;
  }

  // One non-streaming /audio/speech request for a WAV. vLLM overrides it to
  // stream.
  protected requestSpeech(
    speech_request: ResolvedSpeechRequest,
  ): Promise<Response> {
    return this.postSpeech(speech_request, { response_format: 'wav' });
  }

  protected postSpeech(
    speech_request: ResolvedSpeechRequest,
    format_fields: Record<string, unknown>,
  ): Promise<Response> {
    return sendProviderRequest({
      provider_name: this.provider_name,
      url: `${this.resolveBaseUrl(speech_request.base_url)}/audio/speech`,
      method: 'POST',
      api_key: this.connection.api_key,
      json_body: {
        model: speech_request.model,
        voice: speech_request.voice,
        input: speech_request.text,
        speed: speech_request.speed,
        ...(this.supports_speech_instructions && speech_request.instructions
          ? { instructions: speech_request.instructions }
          : {}),
        ...format_fields,
      },
      timeout_ms: speech_request.timeout_ms,
      abort_signal: speech_request.abort_signal,
    });
  }

  // Subclasses add their own switches (thinking off, token limit name).
  protected buildChatBody(
    chat_request: ResolvedChatRequest,
  ): Record<string, unknown> {
    return {
      model: chat_request.model,
      messages: chat_request.messages.map(mapMessageToWire),
      ...(chat_request.tools && chat_request.tools.length > 0
        ? { tools: chat_request.tools }
        : {}),
      temperature: chat_request.temperature,
      max_tokens: chat_request.max_output_tokens,
      stream: true,
      stream_options: { include_usage: true },
    };
  }

  private buildTranscriptionForm(
    transcription_request: ResolvedTranscriptionRequest,
  ): FormData {
    const transcription_form = new FormData();
    transcription_form.append(
      'file',
      new Blob([new Uint8Array(transcription_request.audio)], {
        type: 'audio/wav',
      }),
      'utterance.wav',
    );
    transcription_form.append('model', transcription_request.model);
    transcription_form.append('response_format', 'json');
    if (transcription_request.language) {
      transcription_form.append('language', transcription_request.language);
    }
    if (transcription_request.prompt) {
      transcription_form.append('prompt', transcription_request.prompt);
    }
    return transcription_form;
  }
}
