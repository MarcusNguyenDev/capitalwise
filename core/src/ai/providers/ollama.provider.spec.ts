import { AiProviderRequestFailedError } from '../errors/ai_provider_request_failed.error';
import { AiRequestAbortedError } from '../errors/ai_request_aborted.error';
import { CapabilityNotSupportedError } from '../errors/capability_not_supported.error';
import { ResolvedChatRequest } from '../types/chat_request.type';
import {
  buildStreamedResponse,
  collectEvents,
  splitIntoChunks,
} from './build_streamed_response.fixture';
import { OllamaProvider } from './ollama.provider';

function buildProvider(base_url = 'http://ollama.test:11434/v1') {
  return new OllamaProvider({
    providers: {
      ollama: { base_url, api_key: 'secret-token', context_tokens: 16_384 },
    },
  } as never);
}

function buildChatRequest(
  request_overrides: Partial<ResolvedChatRequest> = {},
): ResolvedChatRequest {
  return {
    model: 'gpt-6:luna',
    messages: [
      { role: 'system', content: 'You are a bank agent.' },
      { role: 'user', content: 'I lost my card.' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          { tool_call_id: 'call_1', name: 'send_identity_push', arguments: {} },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_1',
        name: 'send_identity_push',
        content: '{"ok":true,"result":{"verified":true}}',
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'lock_card',
          description: 'Lock a card',
          parameters: { type: 'object', properties: {} },
        },
      },
    ],
    temperature: 0.4,
    max_output_tokens: 300,
    timeout_ms: 5_000,
    reasoning_effort: 'none',
    ...request_overrides,
  };
}

function toNdjson(lines: Record<string, unknown>[]): string {
  return lines.map((line) => JSON.stringify(line)).join('\n') + '\n';
}

describe('OllamaProvider', () => {
  const original_fetch = global.fetch;

  afterEach(() => {
    global.fetch = original_fetch;
  });

  it('calls the native /api/chat with thinking off, tools, options and mapped messages', async () => {
    const fetch_mock = jest.fn().mockResolvedValue(
      buildStreamedResponse([
        toNdjson([
          { message: { role: 'assistant', content: 'Hi' }, done: false },
          {
            message: { role: 'assistant', content: '' },
            done: true,
            done_reason: 'stop',
          },
        ]),
      ]),
    );
    global.fetch = fetch_mock as unknown as typeof fetch;

    await collectEvents(buildProvider().chat(buildChatRequest()));

    const [request_url, request_init] = fetch_mock.mock.calls[0];
    expect(request_url).toBe('http://ollama.test:11434/api/chat');
    expect(request_init.headers.Authorization).toBe('Bearer secret-token');
    const request_body = JSON.parse(request_init.body);
    expect(request_body).toMatchObject({
      model: 'gpt-6:luna',
      stream: true,
      think: false,
      options: { temperature: 0.4, num_predict: 300, num_ctx: 16_384 },
    });
    expect(request_body.tools[0].function.name).toBe('lock_card');
    expect(request_body.messages[2]).toEqual({
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call_1',
          function: { name: 'send_identity_push', arguments: {} },
        },
      ],
    });
    expect(request_body.messages[3]).toMatchObject({
      role: 'tool',
      tool_name: 'send_identity_push',
      content: '{"ok":true,"result":{"verified":true}}',
    });
  });

  it('streams text deltas split across network chunks and reports usage', async () => {
    const ndjson_text = toNdjson([
      { message: { role: 'assistant', content: 'Hi Sarah, ' }, done: false },
      {
        message: { role: 'assistant', content: 'how can I help?' },
        done: false,
      },
      {
        message: { role: 'assistant', content: '' },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 812,
        prompt_eval_cached_count: 790,
        eval_count: 9,
      },
    ]);
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        buildStreamedResponse(splitIntoChunks(ndjson_text, 7)),
      ) as unknown as typeof fetch;

    const chat_events = await collectEvents(
      buildProvider().chat(buildChatRequest()),
    );

    expect(chat_events).toEqual([
      { type: 'text_delta', text: 'Hi Sarah, ' },
      { type: 'text_delta', text: 'how can I help?' },
      {
        type: 'done',
        finish_reason: 'stop',
        usage: {
          input_tokens: 812,
          output_tokens: 9,
          cached_input_tokens: 790,
        },
      },
    ]);
  });

  it('emits complete tool calls, synthesising an id when Ollama sends none', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      buildStreamedResponse([
        toNdjson([
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  function: {
                    name: 'lock_card',
                    arguments: { card_id: 'CRD-10011' },
                  },
                },
                {
                  id: 'call_abc',
                  function: { name: 'get_held_payments', arguments: '{}' },
                },
              ],
            },
            done: false,
          },
          { message: { content: '' }, done: true, done_reason: 'stop' },
        ]),
      ]),
    ) as unknown as typeof fetch;

    const chat_events = await collectEvents(
      buildProvider().chat(buildChatRequest()),
    );

    expect(chat_events[0]).toEqual({
      type: 'tool_call',
      tool_call_id: expect.stringMatching(/^call_[0-9a-f]{16}$/),
      name: 'lock_card',
      arguments: { card_id: 'CRD-10011' },
    });
    expect(chat_events[1]).toEqual({
      type: 'tool_call',
      tool_call_id: 'call_abc',
      name: 'get_held_payments',
      arguments: {},
    });
    expect(chat_events[2]).toMatchObject({
      type: 'done',
      finish_reason: 'tool_calls',
    });
  });

  it('drops <think> blocks and the separate thinking field', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      buildStreamedResponse([
        toNdjson([
          {
            message: { thinking: 'The user lost a card', content: '' },
            done: false,
          },
          { message: { content: '<thi' }, done: false },
          { message: { content: 'nk>plan the reply</th' }, done: false },
          { message: { content: 'ink>Let us lock it.' }, done: false },
          { message: { content: '' }, done: true, done_reason: 'stop' },
        ]),
      ]),
    ) as unknown as typeof fetch;

    const chat_events = await collectEvents(
      buildProvider().chat(buildChatRequest()),
    );
    const spoken_text = chat_events
      .flatMap((chat_event) =>
        chat_event.type === 'text_delta' ? [chat_event.text] : [],
      )
      .join('');

    expect(spoken_text).toBe('Let us lock it.');
  });

  it('turns an error line, an HTTP error and an abort into typed errors', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        buildStreamedResponse([
          toNdjson([{ error: 'model "gpt-6:luna" not found' }]),
        ]),
      ) as unknown as typeof fetch;
    await expect(
      collectEvents(buildProvider().chat(buildChatRequest())),
    ).rejects.toBeInstanceOf(AiProviderRequestFailedError);

    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('{"error":"model not found"}', { status: 404 }),
      ) as unknown as typeof fetch;
    await expect(
      collectEvents(buildProvider().chat(buildChatRequest())),
    ).rejects.toThrow(/HTTP 404/);

    const abort_controller = new AbortController();
    abort_controller.abort();
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new DOMException('aborted', 'AbortError'),
      ) as unknown as typeof fetch;
    await expect(
      collectEvents(
        buildProvider().chat(
          buildChatRequest({ abort_signal: abort_controller.signal }),
        ),
      ),
    ).rejects.toBeInstanceOf(AiRequestAbortedError);
  });

  it('lists models from /api/tags and refuses speech capabilities', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [{ name: 'gpt-6:luna' }, { name: 'qwen3:1.7b' }],
        }),
      ),
    ) as unknown as typeof fetch;
    const provider = buildProvider('http://ollama.test:11434');

    await expect(provider.listModels(1_000)).resolves.toEqual([
      'gpt-6:luna',
      'qwen3:1.7b',
    ]);
    await expect(
      provider.synthesize({
        text: 'hi',
        model: 'x',
        voice: 'y',
        speed: 1,
        timeout_ms: 1_000,
      }),
    ).rejects.toBeInstanceOf(CapabilityNotSupportedError);
  });

  it('is not configured without a base URL', async () => {
    const provider = buildProvider('');

    expect(provider.isConfigured()).toBe(false);
    await expect(provider.checkHealth(1_000)).resolves.toMatchObject({
      is_reachable: false,
      detail: expect.stringContaining('OLLAMA_BASE_URL'),
    });
  });

  it('maps the voice agent opening round (greeting with a tool call, then its result)', async () => {
    const fetch_mock = jest.fn().mockResolvedValue(
      buildStreamedResponse([
        toNdjson([
          {
            message: { content: 'Hi Sarah.' },
            done: true,
            done_reason: 'stop',
          },
        ]),
      ]),
    );
    global.fetch = fetch_mock as unknown as typeof fetch;
    const greeting =
      "Hello, you've reached Demo Bank's AI specialist. This call is recorded.";

    const chat_events = await collectEvents(
      buildProvider().chat(
        buildChatRequest({
          messages: [
            { role: 'system', content: 'You are a bank agent.' },
            {
              role: 'assistant',
              content: greeting,
              tool_calls: [
                {
                  tool_call_id: 'call_opening_caller_context',
                  name: 'get_caller_context',
                  arguments: {},
                },
              ],
            },
            {
              role: 'tool',
              tool_call_id: 'call_opening_caller_context',
              name: 'get_caller_context',
              content:
                '{"ok":true,"result":{"matched":true,"first_name":"Sarah"}}',
            },
          ],
        }),
      ),
    );

    const request_body = JSON.parse(fetch_mock.mock.calls[0][1].body);
    expect(request_body.messages.slice(1)).toEqual([
      {
        role: 'assistant',
        content: greeting,
        tool_calls: [
          {
            id: 'call_opening_caller_context',
            function: { name: 'get_caller_context', arguments: {} },
          },
        ],
      },
      {
        role: 'tool',
        tool_name: 'get_caller_context',
        tool_call_id: 'call_opening_caller_context',
        content: '{"ok":true,"result":{"matched":true,"first_name":"Sarah"}}',
      },
    ]);
    expect(chat_events[0]).toEqual({ type: 'text_delta', text: 'Hi Sarah.' });
  });
});
