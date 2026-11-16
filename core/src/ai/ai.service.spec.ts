import { AiService } from './ai.service';
import { AiProviderNotConfiguredError } from './errors/ai_provider_not_configured.error';
import { CapabilityNotSupportedError } from './errors/capability_not_supported.error';
import { UnknownAiProviderError } from './errors/unknown_ai_provider.error';
import { AiProvider, AiProviderRegistry } from './providers/ai_provider';
import { AiCapability } from './types/ai_capability.enum';
import { AiProviderName } from './types/ai_provider_name.type';
import { ChatStreamEvent } from './types/chat_stream_event.type';

interface FakeProviderOptions {
  provider_name: AiProviderName;
  capabilities: AiCapability[];
  is_configured?: boolean;
  models?: string[];
}

function buildFakeProvider(fake_options: FakeProviderOptions) {
  const fake_provider = {
    provider_name: fake_options.provider_name,
    capabilities: fake_options.capabilities,
    configuration_hint: `${fake_options.provider_name.toUpperCase()}_BASE_URL`,
    isConfigured: jest.fn().mockReturnValue(fake_options.is_configured ?? true),
    supports: (capability: AiCapability) =>
      fake_options.capabilities.includes(capability),
    listModels: jest.fn().mockResolvedValue(fake_options.models ?? []),
    checkHealth: jest.fn().mockResolvedValue({
      is_reachable: true,
      detail: `${fake_options.provider_name} is reachable.`,
      models: fake_options.models ?? [],
    }),
    chat: jest.fn(async function* (): AsyncGenerator<ChatStreamEvent> {
      yield { type: 'text_delta', text: 'hello' };
    }),
    transcribe: jest.fn().mockResolvedValue({
      text: 'hi',
      duration_seconds: 1,
      provider: fake_options.provider_name,
      model: 'm',
    }),
    synthesize: jest.fn().mockResolvedValue({
      pcm: new Int16Array(10),
      sample_rate: 24_000,
      provider: fake_options.provider_name,
      model: 'm',
      voice: 'v',
    }),
  };
  return fake_provider;
}

function buildAiConfig(config_overrides: Record<string, unknown> = {}) {
  return {
    chat: {
      provider: 'ollama',
      model: 'gpt-6:luna',
      temperature: 0.4,
      max_output_tokens: 300,
      timeout_ms: 30_000,
      reasoning_effort: 'none',
    },
    transcribe: {
      provider: 'speaches',
      model: 'Systran/faster-whisper-small.en',
      language: 'en',
      timeout_ms: 20_000,
    },
    synthesize: {
      provider: 'speaches',
      model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
      ai_voice: 'bf_emma',
      staff_voice: 'bm_george',
      speed: 1,
      timeout_ms: 20_000,
    },
    health_check_timeout_ms: 2_000,
    ...config_overrides,
  };
}

function buildHarness(
  harness_options: {
    is_ollama_configured?: boolean;
    ollama_models?: string[];
    config_overrides?: Record<string, unknown>;
  } = {},
) {
  const ollama = buildFakeProvider({
    provider_name: 'ollama',
    capabilities: [AiCapability.CHAT],
    is_configured: harness_options.is_ollama_configured ?? true,
    models: harness_options.ollama_models ?? ['gpt-6:luna'],
  });
  const vllm = buildFakeProvider({
    provider_name: 'vllm',
    capabilities: [AiCapability.CHAT, AiCapability.TRANSCRIBE],
    models: ['qwen3-8b'],
  });
  const speaches = buildFakeProvider({
    provider_name: 'speaches',
    capabilities: [AiCapability.TRANSCRIBE, AiCapability.SYNTHESIZE],
    models: [
      'Systran/faster-whisper-small.en',
      'speaches-ai/Kokoro-82M-v1.0-ONNX',
    ],
  });
  const provider_registry = new Map([
    ['ollama', ollama],
    ['vllm', vllm],
    ['speaches', speaches],
  ]) as unknown as AiProviderRegistry;
  const ai_service = new AiService(
    provider_registry,
    buildAiConfig(harness_options.config_overrides) as never,
  );
  return { ai_service, ollama, vllm, speaches };
}

async function drain(chat_stream: AsyncIterable<unknown>): Promise<void> {
  for await (const chat_event of chat_stream) {
    void chat_event;
  }
}

describe('AiService', () => {
  describe('routing', () => {
    it('sends each capability to its configured provider with the configured defaults', async () => {
      const { ai_service, ollama, speaches } = buildHarness();

      await drain(
        ai_service.chat({ messages: [{ role: 'user', content: 'hi' }] }),
      );
      await ai_service.transcribe({ audio: Buffer.alloc(0) });
      await ai_service.synthesize({ text: 'Hello' });

      expect(ollama.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-6:luna',
          temperature: 0.4,
          max_output_tokens: 300,
          timeout_ms: 30_000,
          reasoning_effort: 'none',
        }),
      );
      expect(speaches.transcribe).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'Systran/faster-whisper-small.en',
          language: 'en',
        }),
      );
      expect(speaches.synthesize).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
          voice: 'bf_emma',
          speed: 1,
        }),
      );
    });

    it('lets one request override the provider, model and voice', async () => {
      const { ai_service, ollama, vllm, speaches } = buildHarness();

      await drain(
        ai_service.chat(
          { model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }] },
          { provider: 'VLLM' },
        ),
      );
      await ai_service.synthesize({ text: 'Hi', voice: 'af_heart' });

      expect(ollama.chat).not.toHaveBeenCalled();
      expect(vllm.chat).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'qwen3-8b' }),
      );
      expect(speaches.synthesize).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'af_heart' }),
      );
    });

    it('refuses an unsupported capability, an unknown provider and an unconfigured one', async () => {
      const { ai_service } = buildHarness({ is_ollama_configured: false });

      expect(() =>
        ai_service.chat(
          { messages: [{ role: 'user', content: 'hi' }] },
          { provider: 'speaches' },
        ),
      ).toThrow(CapabilityNotSupportedError);
      await expect(
        ai_service.synthesize({ text: 'hi' }, { provider: 'deepgram' }),
      ).rejects.toBeInstanceOf(UnknownAiProviderError);
      expect(() =>
        ai_service.chat({ messages: [{ role: 'user', content: 'hi' }] }),
      ).toThrow(
        new AiProviderNotConfiguredError(
          'Chat provider ollama is not configured. Set OLLAMA_BASE_URL in core/.env.',
        ),
      );
    });

    it('validates the configured routes at startup without crashing', () => {
      const { ai_service } = buildHarness({
        config_overrides: {
          synthesize: {
            ...buildAiConfig().synthesize,
            provider: 'vllm',
          },
        },
      });

      expect(() => ai_service.onModuleInit()).not.toThrow();
    });
  });

  describe('status', () => {
    it('reports every capability reachable when probes answer and list the models', async () => {
      const { ai_service } = buildHarness();

      const ai_status = await ai_service.getStatus();

      expect(ai_status.capabilities.chat).toMatchObject({
        provider: 'ollama',
        model: 'gpt-6:luna',
        is_reachable: true,
      });
      expect(ai_status.capabilities.synthesize).toMatchObject({
        is_reachable: true,
        voice: 'bf_emma',
        staff_voice: 'bm_george',
      });
      expect(ai_status.providers.ollama).toEqual({
        capabilities: [AiCapability.CHAT],
        is_configured: true,
      });
    });

    it('explains an unconfigured provider, a missing model and an unsupported route', async () => {
      const unconfigured = buildHarness({ is_ollama_configured: false });
      const missing_model = buildHarness({ ollama_models: ['qwen3:1.7b'] });
      const wrong_route = buildHarness({
        config_overrides: {
          synthesize: { ...buildAiConfig().synthesize, provider: 'vllm' },
        },
      });

      const unconfigured_status = await unconfigured.ai_service.getStatus();
      const missing_model_status = await missing_model.ai_service.getStatus();
      const wrong_route_status = await wrong_route.ai_service.getStatus();

      expect(unconfigured_status.capabilities.chat).toMatchObject({
        is_reachable: false,
        detail:
          'Chat provider ollama is not configured. Set OLLAMA_BASE_URL in core/.env.',
      });
      expect(missing_model_status.capabilities.chat.detail).toMatch(
        /model gpt-6:luna is not available on ollama \(it lists: qwen3:1.7b\)/,
      );
      expect(wrong_route_status.capabilities.synthesize).toMatchObject({
        is_reachable: false,
        detail: expect.stringContaining('does not support SYNTHESIZE'),
      });
    });

    it('accepts an Ollama model listed with the :latest tag', async () => {
      const { ai_service } = buildHarness({
        ollama_models: ['gpt-6:luna:latest'],
        config_overrides: {
          chat: { ...buildAiConfig().chat, model: 'gpt-6:luna' },
        },
      });

      expect((await ai_service.getStatus()).capabilities.chat.is_reachable).toBe(
        true,
      );
    });

    it('caches each provider probe so status polling does not hammer it', async () => {
      const { ai_service, speaches } = buildHarness();

      await ai_service.getStatus();
      await ai_service.getStatus();

      // Speaches serves two capabilities but is probed once.
      expect(speaches.checkHealth).toHaveBeenCalledTimes(1);
    });
  });

  it('is built on the shared AiProvider contract', () => {
    expect(typeof AiProvider.prototype.checkHealth).toBe('function');
  });
});
