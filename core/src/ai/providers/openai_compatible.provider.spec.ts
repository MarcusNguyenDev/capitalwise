import { encodeWav } from '../../audio/encode_wav.util';
import { CapabilityNotSupportedError } from '../errors/capability_not_supported.error';
import { ResolvedChatRequest } from '../types/chat_request.type';
import {
  buildStreamedResponse,
  collectEvents,
  splitIntoChunks,
} from './build_streamed_response.fixture';
import { OpenAiProvider } from './openai.provider';
import { SpeachesProvider } from './speaches.provider';
import { VllmProvider } from './vllm.provider';

const PROVIDER_CONFIG = {
  providers: {
    vllm: { base_url: 'http://vllm.test:8000/v1', api_key: '' },
    openai: { base_url: 'https://api.openai.test/v1', api_key: 'sk-test' },
    speaches: { base_url: 'http://speech.test:8000/v1', api_key: '' },
  },
} as never;

function buildChatRequest(
  request_overrides: Partial<ResolvedChatRequest> = {},
): ResolvedChatRequest {
  return {
    model: 'qwen3-8b',
    messages: [
      { role: 'system', content: 'You are a bank agent.' },
      { role: 'user', content: 'I lost my card.' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            tool_call_id: 'call_1',
            name: 'lock_card',
            arguments: { card_id: 'CRD-10011' },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_1',
        name: 'lock_card',
        content: '{"ok":true}',
      },
    ],
    temperature: 0.4,
    max_output_tokens: 300,
    timeout_ms: 5_000,
    reasoning_effort: 'none',
    ...request_overrides,
  };
}

function toSse(payloads: Record<string, unknown>[]): string {
  return (
    payloads.map((payload) => `data: ${JSON.stringify(payload)}\n\n`).join('') +
    'data: [DONE]\n\n'
  );
}

function textChunk(content: string): Record<string, unknown> {
  return { choices: [{ index: 0, delta: { content } }] };
}

describe('OpenAI-compatible providers', () => {
  const original_fetch = global.fetch;

  afterEach(() => {
    global.fetch = original_fetch;
  });

  describe('chat', () => {
    it('streams text from SSE chunks split mid-line and reads usage from the last chunk', async () => {
      const sse_text = toSse([
        textChunk('Your card '),
        textChunk('is locked.'),
        { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
        {
          choices: [],
          usage: {
            prompt_tokens: 900,
            completion_tokens: 6,
            prompt_tokens_details: { cached_tokens: 850 },
          },
        },
      ]);
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          buildStreamedResponse(splitIntoChunks(sse_text, 11)),
        ) as unknown as typeof fetch;

      const chat_events = await collectEvents(
        new VllmProvider(PROVIDER_CONFIG).chat(buildChatRequest()),
      );

      expect(chat_events).toEqual([
        { type: 'text_delta', text: 'Your card ' },
        { type: 'text_delta', text: 'is locked.' },
        {
          type: 'done',
          finish_reason: 'stop',
          usage: { input_tokens: 900, output_tokens: 6, cached_input_tokens: 850 },
        },
      ]);
    });

    it('assembles tool-call arguments streamed as JSON string fragments', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        buildStreamedResponse([
          toSse([
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: 'call_x1',
                        type: 'function',
                        function: { name: 'lock_card', arguments: '' },
                      },
                    ],
                  },
                },
              ],
            },
            {
              choices: [
                {
                  delta: {
                    tool_calls: [{ index: 0, function: { arguments: '{"card_' } }],
                  },
                },
              ],
            },
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      { index: 0, function: { arguments: 'id":"CRD-10011"}' } },
                      {
                        index: 1,
                        id: 'call_x2',
                        function: { name: 'update_call_insight', arguments: '{}' },
                      },
                    ],
                  },
                },
              ],
            },
            { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
          ]),
        ]),
      ) as unknown as typeof fetch;

      const chat_events = await collectEvents(
        new VllmProvider(PROVIDER_CONFIG).chat(buildChatRequest()),
      );

      expect(chat_events).toEqual([
        {
          type: 'tool_call',
          tool_call_id: 'call_x1',
          name: 'lock_card',
          arguments: { card_id: 'CRD-10011' },
        },
        {
          type: 'tool_call',
          tool_call_id: 'call_x2',
          name: 'update_call_insight',
          arguments: {},
        },
        {
          type: 'done',
          finish_reason: 'tool_calls',
          usage: { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 },
        },
      ]);
    });

    it('ignores reasoning fields and strips <think> blocks split across chunks', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        buildStreamedResponse([
          toSse([
            { choices: [{ delta: { reasoning_content: 'hmm, a card' } }] },
            { choices: [{ delta: { reasoning: 'still thinking' } }] },
            textChunk('<think>quietly'),
            textChunk(' plan</thi'),
            textChunk('nk>Done. '),
            textChunk('Anything else?'),
          ]),
        ]),
      ) as unknown as typeof fetch;

      const chat_events = await collectEvents(
        new VllmProvider(PROVIDER_CONFIG).chat(buildChatRequest()),
      );
      const spoken_text = chat_events
        .flatMap((chat_event) =>
          chat_event.type === 'text_delta' ? [chat_event.text] : [],
        )
        .join('');

      expect(spoken_text).toBe('Done. Anything else?');
    });

    it('sends OpenAI-style messages, and vLLM switches the chat template thinking off', async () => {
      const fetch_mock = jest
        .fn()
        .mockResolvedValue(buildStreamedResponse([toSse([textChunk('ok')])]));
      global.fetch = fetch_mock as unknown as typeof fetch;

      await collectEvents(new VllmProvider(PROVIDER_CONFIG).chat(buildChatRequest()));

      const [request_url, request_init] = fetch_mock.mock.calls[0];
      const request_body = JSON.parse(request_init.body);
      expect(request_url).toBe('http://vllm.test:8000/v1/chat/completions');
      expect(request_init.headers.Authorization).toBeUndefined();
      expect(request_body).toMatchObject({
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: 300,
        chat_template_kwargs: { enable_thinking: false },
      });
      expect(request_body.messages[2]).toEqual({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'lock_card', arguments: '{"card_id":"CRD-10011"}' },
          },
        ],
      });
      expect(request_body.messages[3]).toMatchObject({
        role: 'tool',
        tool_call_id: 'call_1',
      });
    });

    it('OpenAI uses max_completion_tokens and sends reasoning_effort only when not "none"', async () => {
      const fetch_mock = jest
        .fn()
        .mockImplementation(async () =>
          buildStreamedResponse([toSse([textChunk('ok')])]),
        );
      global.fetch = fetch_mock as unknown as typeof fetch;
      const openai_provider = new OpenAiProvider(PROVIDER_CONFIG);

      await collectEvents(openai_provider.chat(buildChatRequest()));
      await collectEvents(
        openai_provider.chat(buildChatRequest({ reasoning_effort: 'low' })),
      );

      const first_body = JSON.parse(fetch_mock.mock.calls[0][1].body);
      const second_body = JSON.parse(fetch_mock.mock.calls[1][1].body);
      expect(fetch_mock.mock.calls[0][1].headers.Authorization).toBe(
        'Bearer sk-test',
      );
      expect(first_body.max_completion_tokens).toBe(300);
      expect(first_body.max_tokens).toBeUndefined();
      expect(first_body.reasoning_effort).toBeUndefined();
      expect(second_body.reasoning_effort).toBe('low');
    });
  });

  describe('speech', () => {
    it('transcribes a WAV through a multipart form and reports its duration', async () => {
      const fetch_mock = jest
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ text: ' I lost my card. ' })));
      global.fetch = fetch_mock as unknown as typeof fetch;
      const one_and_a_half_seconds = encodeWav(new Int16Array(24_000), 16_000);

      const transcription_result = await new SpeachesProvider(
        PROVIDER_CONFIG,
      ).transcribe({
        audio: one_and_a_half_seconds,
        model: 'Systran/faster-whisper-small.en',
        language: 'en',
        timeout_ms: 5_000,
      });

      expect(transcription_result).toEqual({
        text: 'I lost my card.',
        duration_seconds: 1.5,
        provider: 'speaches',
        model: 'Systran/faster-whisper-small.en',
      });
      const [request_url, request_init] = fetch_mock.mock.calls[0];
      expect(request_url).toBe('http://speech.test:8000/v1/audio/transcriptions');
      const transcription_form = request_init.body as FormData;
      expect(transcription_form.get('model')).toBe(
        'Systran/faster-whisper-small.en',
      );
      expect(transcription_form.get('language')).toBe('en');
      expect(transcription_form.get('file')).toBeInstanceOf(Blob);
    });

    it('asks for a WAV and returns 16-bit PCM resampled to the rate asked for', async () => {
      const source_pcm = new Int16Array(22_050).fill(1000);
      const fetch_mock = jest
        .fn()
        .mockResolvedValue(
          new Response(new Uint8Array(encodeWav(source_pcm, 22_050))),
        );
      global.fetch = fetch_mock as unknown as typeof fetch;

      const speech_result = await new SpeachesProvider(PROVIDER_CONFIG).synthesize({
        text: 'Hello',
        model: 'speaches-ai/piper-en_GB-alba-medium',
        voice: 'alba',
        speed: 1,
        sample_rate: 24_000,
        timeout_ms: 5_000,
      });

      expect(JSON.parse(fetch_mock.mock.calls[0][1].body)).toEqual({
        model: 'speaches-ai/piper-en_GB-alba-medium',
        voice: 'alba',
        input: 'Hello',
        speed: 1,
        response_format: 'wav',
      });
      expect(speech_result.sample_rate).toBe(24_000);
      expect(speech_result.pcm).toBeInstanceOf(Int16Array);
      expect(speech_result.pcm.length).toBe(24_000);
      expect(speech_result.pcm[100]).toBe(1000);
      expect(speech_result).toMatchObject({ provider: 'speaches', voice: 'alba' });
    });

    it('Speaches has no chat and vLLM has no speech', async () => {
      await expect(
        collectEvents(new SpeachesProvider(PROVIDER_CONFIG).chat(buildChatRequest())),
      ).rejects.toBeInstanceOf(CapabilityNotSupportedError);
      await expect(
        new VllmProvider(PROVIDER_CONFIG).synthesize({
          text: 'hi',
          model: 'x',
          voice: 'y',
          speed: 1,
          timeout_ms: 1_000,
        }),
      ).rejects.toBeInstanceOf(CapabilityNotSupportedError);
    });
  });

  it('OpenAI needs a key to count as configured', () => {
    const keyless_provider = new OpenAiProvider({
      providers: { openai: { base_url: 'https://api.openai.com/v1', api_key: '' } },
    } as never);

    expect(keyless_provider.isConfigured()).toBe(false);
    expect(new OpenAiProvider(PROVIDER_CONFIG).isConfigured()).toBe(true);
  });
});
