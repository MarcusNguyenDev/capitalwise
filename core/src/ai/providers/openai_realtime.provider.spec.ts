import { AiProviderRequestFailedError } from '../errors/ai_provider_request_failed.error';
import { AiRequestAbortedError } from '../errors/ai_request_aborted.error';
import { READER_INSTRUCTIONS } from '../wire/openai_realtime.reader';
import {
  buildStreamedResponse,
  collectEvents,
} from './build_streamed_response.fixture';
import {
  buildFakeSocketFactory,
  encodeSamplesBase64,
  waitForCondition,
} from './fake_realtime_web_socket.fixture';
import { OpenAiProvider } from './openai.provider';

const OPENAI_CONFIG = {
  providers: {
    openai: { base_url: 'https://api.openai.test/v1', api_key: 'sk-test' },
  },
} as never;

function buildProvider() {
  const socket_factory = buildFakeSocketFactory();
  const provider = new OpenAiProvider(
    OPENAI_CONFIG,
    socket_factory.createWebSocket,
  );
  return { provider, sockets: socket_factory.sockets };
}

function openTranscription(
  provider: OpenAiProvider,
  model = 'gpt-live-transcribe',
) {
  return provider.openTranscriptionStream({
    model,
    language: 'en',
    timeout_ms: 2_000,
  });
}

function buildSpeechRequest(request_overrides: Record<string, unknown> = {}) {
  return {
    text: 'Your card is locked.',
    model: 'gpt-realtime-2.1-mini',
    session_key: 'call-1',
    voice: 'marin',
    speed: 1,
    instructions: 'Warm and calm.',
    sample_rate: 24_000,
    timeout_ms: 2_000,
    ...request_overrides,
  };
}

describe('OpenAI Realtime transcription stream', () => {
  it('opens a transcription session with our own turn detection', async () => {
    const { provider, sockets } = buildProvider();

    openTranscription(provider);
    await waitForCondition(
      () => sockets[0]?.readSent('session.update').length === 1,
      'the session update',
    );

    expect(sockets[0].url).toBe(
      'wss://api.openai.test/v1/realtime?intent=transcription',
    );
    expect(sockets[0].headers).toEqual({ Authorization: 'Bearer sk-test' });
    expect(sockets[0].readSent('session.update')[0]).toEqual({
      type: 'session.update',
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24_000 },
            transcription: { model: 'gpt-live-transcribe', languages: ['en'] },
            turn_detection: null,
          },
        },
      },
    });
  });

  it('uses the singular language field for the other transcription models', async () => {
    const { provider, sockets } = buildProvider();

    openTranscription(provider, 'gpt-transcribe');
    await waitForCondition(
      () => sockets[0]?.readSent('session.update').length === 1,
      'the session update',
    );

    const session = sockets[0].readSent('session.update')[0].session as {
      audio: { input: { transcription: Record<string, unknown> } };
    };
    expect(session.audio.input.transcription).toEqual({
      model: 'gpt-transcribe',
      language: 'en',
    });
  });

  it('streams 16 kHz audio as 24 kHz PCM16, commits, relays deltas and resolves the transcript', async () => {
    const { provider, sockets } = buildProvider();
    const transcription_stream = openTranscription(provider);
    const deltas: string[] = [];
    transcription_stream.onDelta((delta) => deltas.push(delta));
    await waitForCondition(
      () => sockets[0]?.readSent('session.update').length === 1,
      'setup',
    );
    await new Promise((resolve) => setImmediate(resolve));

    transcription_stream.appendAudio(new Int16Array(1_600).fill(1000), 16_000);
    const transcription_promise = transcription_stream.commit();
    const fake_socket = sockets[0];
    await waitForCondition(
      () => fake_socket.readSent('input_audio_buffer.commit').length === 1,
      'the commit',
    );
    fake_socket.emitServerEvent({
      type: 'input_audio_buffer.committed',
      item_id: 'item_1',
    });
    fake_socket.emitServerEvent({
      type: 'conversation.item.input_audio_transcription.delta',
      item_id: 'item_1',
      delta: 'I lost ',
    });
    fake_socket.emitServerEvent({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item_1',
      transcript: ' I lost my card. ',
      usage: { type: 'duration', seconds: 0.1 },
    });

    await expect(transcription_promise).resolves.toEqual({
      text: 'I lost my card.',
      duration_seconds: 0.1,
      provider: 'openai',
      model: 'gpt-live-transcribe',
    });
    const appended = fake_socket.readSent('input_audio_buffer.append');
    const appended_bytes = appended.reduce(
      (byte_total, append_event) =>
        byte_total + Buffer.from(String(append_event.audio), 'base64').length,
      0,
    );
    // 100 ms at 24 kHz, 2 bytes a sample.
    expect(appended_bytes).toBe(2_400 * 2);
    expect(deltas).toEqual(['I lost ']);
  });

  it('rejects a turn the server could not transcribe', async () => {
    const { provider, sockets } = buildProvider();
    const transcription_stream = openTranscription(provider);
    await waitForCondition(
      () => sockets[0]?.readSent('session.update').length === 1,
      'setup',
    );
    await new Promise((resolve) => setImmediate(resolve));

    transcription_stream.appendAudio(new Int16Array(4_800), 24_000);
    const transcription_promise = transcription_stream.commit();
    await waitForCondition(
      () => sockets[0].readSent('input_audio_buffer.commit').length === 1,
      'the commit',
    );
    sockets[0].emitServerEvent({
      type: 'input_audio_buffer.committed',
      item_id: 'item_9',
    });
    sockets[0].emitServerEvent({
      type: 'conversation.item.input_audio_transcription.failed',
      item_id: 'item_9',
      error: { code: 'audio_unintelligible', message: 'Could not transcribe' },
    });

    await expect(transcription_promise).rejects.toBeInstanceOf(
      AiProviderRequestFailedError,
    );
  });

  it('reconnects after a dropped connection and replays the unanswered turn', async () => {
    const { provider, sockets } = buildProvider();
    const transcription_stream = openTranscription(provider);
    await waitForCondition(
      () => sockets[0]?.readSent('session.update').length === 1,
      'setup',
    );
    await new Promise((resolve) => setImmediate(resolve));

    transcription_stream.appendAudio(new Int16Array(2_400).fill(500), 24_000);
    const transcription_promise = transcription_stream.commit();
    await waitForCondition(
      () => sockets[0].readSent('input_audio_buffer.commit').length === 1,
      'the first commit',
    );
    sockets[0].dropConnection();
    await waitForCondition(
      () => sockets[1]?.readSent('input_audio_buffer.commit').length === 1,
      'the replayed commit',
    );
    expect(sockets[1].readSent('input_audio_buffer.append')).toHaveLength(1);
    sockets[1].emitServerEvent({
      type: 'input_audio_buffer.committed',
      item_id: 'item_2',
    });
    sockets[1].emitServerEvent({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item_2',
      transcript: 'Hello again.',
    });

    await expect(transcription_promise).resolves.toMatchObject({
      text: 'Hello again.',
      duration_seconds: 0.1,
    });
  });

  it('clears a false start and closes cleanly', async () => {
    const { provider, sockets } = buildProvider();
    const transcription_stream = openTranscription(provider);
    await waitForCondition(
      () => sockets[0]?.readSent('session.update').length === 1,
      'setup',
    );
    await new Promise((resolve) => setImmediate(resolve));

    transcription_stream.clear();
    await transcription_stream.close();

    expect(sockets[0].readSent('input_audio_buffer.clear')).toHaveLength(1);
    expect(sockets[0].is_closed).toBe(true);
  });

  it('keeps whisper-1 on the file endpoint, one WAV per committed turn', async () => {
    const { provider, sockets } = buildProvider();
    const original_fetch = global.fetch;
    const fetch_mock = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ text: 'Hi.' })));
    global.fetch = fetch_mock as unknown as typeof fetch;
    try {
      const transcription_stream = openTranscription(provider, 'whisper-1');
      transcription_stream.appendAudio(new Int16Array(16_000), 16_000);

      await expect(transcription_stream.commit()).resolves.toMatchObject({
        text: 'Hi.',
        duration_seconds: 1,
      });
      expect(sockets).toHaveLength(0);
      expect(fetch_mock.mock.calls[0][0]).toBe(
        'https://api.openai.test/v1/audio/transcriptions',
      );
    } finally {
      global.fetch = original_fetch;
    }
  });
});

describe('OpenAI Realtime voice as a reader', () => {
  async function playResponse(
    sockets: ReturnType<typeof buildProvider>['sockets'],
    response_script: {
      transcript: string;
      status?: string;
      socket_index?: number;
    },
  ) {
    const socket_index = response_script.socket_index ?? 0;
    await waitForCondition(
      () =>
        (sockets[socket_index]?.readSent('response.create').length ?? 0) > 0,
      'the response request',
    );
    const fake_socket = sockets[socket_index];
    const response_request = fake_socket.readSent('response.create').at(-1) as {
      response: { metadata: { request_id: string } };
    };
    fake_socket.emitServerEvent({
      type: 'response.created',
      response: {
        id: 'resp_1',
        metadata: { request_id: response_request.response.metadata.request_id },
      },
    });
    fake_socket.emitServerEvent({
      type: 'response.output_audio.delta',
      response_id: 'resp_1',
      delta: encodeSamplesBase64([1, 2, 3]),
    });
    fake_socket.emitServerEvent({
      type: 'response.output_audio.delta',
      response_id: 'resp_1',
      delta: encodeSamplesBase64([4, 5]),
    });
    fake_socket.emitServerEvent({
      type: 'response.output_audio_transcript.done',
      response_id: 'resp_1',
      transcript: response_script.transcript,
    });
    fake_socket.emitServerEvent({
      type: 'response.done',
      response: {
        id: 'resp_1',
        status: response_script.status ?? 'completed',
        usage: {
          input_token_details: { text_tokens: 60, cached_tokens: 40 },
          output_token_details: { audio_tokens: 90, text_tokens: 8 },
        },
      },
    });
  }

  it('configures a reader session and sends each line out of band', async () => {
    const { provider, sockets } = buildProvider();

    const speech_stream = provider.synthesizeStream(buildSpeechRequest());
    const collected = collectEvents(speech_stream);
    await playResponse(sockets, { transcript: 'Your card is locked.' });
    await collected;

    expect(sockets[0].url).toBe(
      'wss://api.openai.test/v1/realtime?model=gpt-realtime-2.1-mini',
    );
    const session = sockets[0].readSent('session.update')[0].session as Record<
      string,
      unknown
    >;
    expect(session).toEqual({
      type: 'realtime',
      instructions: `${READER_INSTRUCTIONS}\nVoice style: Warm and calm.`,
      output_modalities: ['audio'],
      tools: [],
      audio: {
        input: { turn_detection: null },
        output: {
          format: { type: 'audio/pcm', rate: 24_000 },
          voice: 'marin',
          speed: 1,
        },
      },
    });
    const response_request = sockets[0].readSent('response.create')[0] as {
      response: Record<string, unknown> & {
        input: { content: { text: string }[] }[];
      };
    };
    expect(response_request.response).toMatchObject({
      conversation: 'none',
      output_modalities: ['audio'],
      metadata: { request_id: expect.any(String) },
    });
    expect(response_request.response.input[0].content[0].text).toContain(
      'Your card is locked.',
    );
  });

  it('streams audio deltas as PCM and summarises usage and the transcript', async () => {
    const { provider, sockets } = buildProvider();

    const speech_stream = provider.synthesizeStream(buildSpeechRequest());
    const collected = collectEvents(speech_stream);
    await playResponse(sockets, { transcript: 'Your card is locked.' });

    const chunks = await collected;
    expect(chunks.map((chunk) => [...chunk])).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
    await expect(speech_stream.summary).resolves.toMatchObject({
      provider: 'openai',
      model: 'gpt-realtime-2.1-mini',
      voice: 'marin',
      spoken_transcript: 'Your card is locked.',
      is_drifted: false,
      usage: {
        input_text_tokens: 60,
        cached_input_tokens: 40,
        output_audio_tokens: 90,
        output_text_tokens: 8,
      },
    });
  });

  it('flags a line the voice changed, but tolerates numbers read as words', async () => {
    const { provider, sockets } = buildProvider();

    const drifted_stream = provider.synthesizeStream(buildSpeechRequest());
    const drifted_collected = collectEvents(drifted_stream);
    await playResponse(sockets, {
      transcript:
        'Sure! I have gone ahead and frozen everything for you today.',
    });
    await drifted_collected;
    const numbers_stream = provider.synthesizeStream(
      buildSpeechRequest({ text: 'Your card ending 4821 is locked.' }),
    );
    const numbers_collected = collectEvents(numbers_stream);
    await waitForCondition(
      () => sockets[0].readSent('response.create').length === 2,
      'the second line on the same session',
    );
    await playResponse(sockets, {
      transcript: 'Your card ending four eight two one is locked.',
    });
    await numbers_collected;

    expect((await drifted_stream.summary).is_drifted).toBe(true);
    expect((await numbers_stream.summary).is_drifted).toBe(false);
    // Both lines went through one pooled session.
    expect(sockets).toHaveLength(1);
  });

  it('cancels the response on barge-in', async () => {
    const { provider, sockets } = buildProvider();
    const abort_controller = new AbortController();

    const speech_stream = provider.synthesizeStream(
      buildSpeechRequest({ abort_signal: abort_controller.signal }),
    );
    const collected = collectEvents(speech_stream);
    await waitForCondition(
      () => (sockets[0]?.readSent('response.create').length ?? 0) > 0,
      'the response request',
    );
    const request_id = (
      sockets[0].readSent('response.create')[0] as {
        response: { metadata: { request_id: string } };
      }
    ).response.metadata.request_id;
    sockets[0].emitServerEvent({
      type: 'response.created',
      response: { id: 'resp_7', metadata: { request_id } },
    });
    abort_controller.abort();

    await expect(collected).rejects.toBeInstanceOf(AiRequestAbortedError);
    expect(sockets[0].readSent('response.cancel')).toEqual([
      { type: 'response.cancel', response_id: 'resp_7' },
    ]);
    sockets[0].emitServerEvent({
      type: 'response.done',
      response: { id: 'resp_7', status: 'cancelled' },
    });
    await expect(speech_stream.summary).resolves.toMatchObject({
      is_drifted: false,
    });
  });

  it('turns a failed response into a provider error', async () => {
    const { provider, sockets } = buildProvider();

    const collected = collectEvents(
      provider.synthesizeStream(buildSpeechRequest()),
    );
    await waitForCondition(
      () => (sockets[0]?.readSent('response.create').length ?? 0) > 0,
      'the response request',
    );
    sockets[0].emitServerEvent({
      type: 'response.done',
      response: {
        id: 'resp_x',
        status: 'failed',
        status_details: { error: { message: 'Rate limit reached' } },
      },
    });

    await expect(collected).rejects.toThrow(/Rate limit reached/);
  });

  it('collects the whole line for synthesize()', async () => {
    const { provider, sockets } = buildProvider();

    const speech_promise = provider.synthesize(buildSpeechRequest());
    await playResponse(sockets, { transcript: 'Your card is locked.' });

    const speech_result = await speech_promise;
    expect([...speech_result.pcm]).toEqual([1, 2, 3, 4, 5]);
    expect(speech_result.sample_rate).toBe(24_000);
  });

  it('uses /audio/speech with streamed PCM for the dedicated TTS models', async () => {
    const { provider, sockets } = buildProvider();
    const original_fetch = global.fetch;
    const pcm_bytes = Buffer.from(Int16Array.from([10, 20, 30]).buffer);
    const fetch_mock = jest.fn().mockResolvedValue(
      // A sample split across two network chunks.
      buildStreamedResponse([
        pcm_bytes.subarray(0, 3).toString('latin1'),
        pcm_bytes.subarray(3).toString('latin1'),
      ]),
    );
    global.fetch = fetch_mock as unknown as typeof fetch;
    try {
      const chunks = await collectEvents(
        provider.synthesizeStream(
          buildSpeechRequest({ model: 'gpt-4o-mini-tts' }),
        ),
      );

      expect(sockets).toHaveLength(0);
      const [request_url, request_init] = fetch_mock.mock.calls[0];
      expect(request_url).toBe('https://api.openai.test/v1/audio/speech');
      expect(JSON.parse(request_init.body)).toMatchObject({
        model: 'gpt-4o-mini-tts',
        voice: 'marin',
        response_format: 'pcm',
        instructions: 'Warm and calm.',
      });
      expect(chunks.length).toBeGreaterThan(0);
    } finally {
      global.fetch = original_fetch;
    }
  });

  it("closes a call's reader sessions when the call ends, and one-off sessions right away", async () => {
    const { provider, sockets } = buildProvider();

    const call_line = provider.synthesizeStream(buildSpeechRequest());
    const call_collected = collectEvents(call_line);
    await playResponse(sockets, { transcript: 'Your card is locked.' });
    await call_collected;
    await call_line.summary;
    await new Promise((resolve) => setImmediate(resolve));
    expect(sockets[0].is_closed).toBe(false);

    provider.releaseSessions('call-1');
    expect(sockets[0].is_closed).toBe(true);

    const one_off_line = provider.synthesizeStream(
      buildSpeechRequest({ session_key: undefined }),
    );
    const one_off_collected = collectEvents(one_off_line);
    await playResponse(sockets, {
      transcript: 'Your card is locked.',
      socket_index: 1,
    });
    await one_off_collected;
    await one_off_line.summary;
    await new Promise((resolve) => setImmediate(resolve));
    expect(sockets[1].is_closed).toBe(true);
  });
});

describe('OpenAI reachability probe', () => {
  it('is one free GET /models and opens no Realtime session', async () => {
    const { provider, sockets } = buildProvider();
    const original_fetch = global.fetch;
    const fetch_mock = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: 'gpt-6-luna' }] })),
      );
    global.fetch = fetch_mock as unknown as typeof fetch;
    try {
      const provider_health = await provider.checkHealth(2_000);

      expect(provider_health.is_reachable).toBe(true);
      expect(fetch_mock).toHaveBeenCalledTimes(1);
      expect(fetch_mock.mock.calls[0][0]).toBe(
        'https://api.openai.test/v1/models',
      );
      expect(fetch_mock.mock.calls[0][1].method).toBe('GET');
      expect(sockets).toHaveLength(0);
    } finally {
      global.fetch = original_fetch;
    }
  });
});
