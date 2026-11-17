import { EngineApiClient } from './engine_api.client';
import { EngineApiRejectedError } from './errors/engine_api_rejected.error';
import { EngineApiUnavailableError } from './errors/engine_api_unavailable.error';

const CALL_ID = '0b0f7c0e-5d3a-4f6e-9a55-3a3f3a3f3a3f';

describe('EngineApiClient', () => {
  const original_fetch = global.fetch;
  const engine_api_client = new EngineApiClient({
    base_url: 'http://localhost:3002',
    request_timeout_ms: 1000,
  });

  afterEach(() => {
    global.fetch = original_fetch;
  });

  function mockFetch(response: {
    ok: boolean;
    status: number;
    body: unknown;
  }): jest.Mock {
    const fetch_mock = jest.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status,
      json: async () => response.body,
    });
    global.fetch = fetch_mock as unknown as typeof fetch;
    return fetch_mock;
  }

  it('encodes the caller number in the lookup query', async () => {
    const fetch_mock = mockFetch({
      ok: true,
      status: 200,
      body: {
        matched: true,
        customer_id: 'CUS-1001',
        first_name: 'Sarah',
        full_name: 'Sarah Mitchell',
      },
    });

    const customer_lookup =
      await engine_api_client.lookupCustomer('+61491570156');

    expect(fetch_mock.mock.calls[0][0]).toBe(
      'http://localhost:3002/api/banking/customers/lookup?mobile_phone=%2B61491570156',
    );
    expect(customer_lookup.customer_id).toBe('CUS-1001');
  });

  it('sends the call id with account reads, omits undefined query values and posts JSON bodies', async () => {
    const fetch_mock = mockFetch({ ok: true, status: 200, body: { fees: [] } });
    await engine_api_client.getFeeHistory({
      customer_id: 'CUS-1002',
      call_id: CALL_ID,
    });
    expect(fetch_mock.mock.calls[0][0]).toBe(
      `http://localhost:3002/api/banking/customers/CUS-1002/fee_history?call_id=${CALL_ID}`,
    );

    await engine_api_client.respondToNotification('NTF-00001', 'APPROVED');
    const [request_url, request_init] = fetch_mock.mock.calls[1];
    expect(request_url).toBe(
      'http://localhost:3002/api/notifications/NTF-00001/response',
    );
    expect(JSON.parse(request_init.body)).toEqual({ response: 'APPROVED' });
  });

  it('maps an api error body to a typed rejection', async () => {
    mockFetch({
      ok: false,
      status: 403,
      body: {
        status_code: 403,
        error_code: 'IDENTITY_LEVEL_REQUIRED',
        message: 'Confirm identity to level 2 first.',
        required_level: 2,
        current_level: 1,
      },
    });

    const rejection = await engine_api_client
      .proposeAction({
        call_id: 'x',
        action_code: 'REFUND_FEE',
        params: {},
        summary: 's',
      })
      .catch((error) => error);

    expect(rejection).toBeInstanceOf(EngineApiRejectedError);
    expect(rejection).toMatchObject({
      error_code: 'ENGINE_API_REJECTED',
      api_status_code: 403,
      api_error_code: 'IDENTITY_LEVEL_REQUIRED',
      api_message: 'Confirm identity to level 2 first.',
      api_details: { required_level: 2, current_level: 1 },
    });
  });

  it('posts identity challenges and answers to the identity endpoints', async () => {
    const fetch_mock = mockFetch({ ok: true, status: 200, body: {} });

    await engine_api_client.startIdentityChallenge({
      call_id: CALL_ID,
      level: 2,
    });
    await engine_api_client.submitIdentityAnswers('IDC-000001', {
      call_id: CALL_ID,
      answers: [{ question_id: 'Q1', answer: 'about $4,200' }],
    });

    expect(fetch_mock.mock.calls[0][0]).toBe(
      'http://localhost:3002/api/identity/challenges',
    );
    expect(JSON.parse(fetch_mock.mock.calls[0][1].body)).toEqual({
      call_id: CALL_ID,
      level: 2,
    });
    expect(fetch_mock.mock.calls[1][0]).toBe(
      'http://localhost:3002/api/identity/challenges/IDC-000001/answers',
    );
  });

  it('treats 5xx answers and network failures as unavailable', async () => {
    mockFetch({ ok: false, status: 500, body: null });
    await expect(
      engine_api_client.getHeldPayments({
        customer_id: 'CUS-1004',
        call_id: CALL_ID,
      }),
    ).rejects.toBeInstanceOf(EngineApiUnavailableError);

    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('fetch failed')) as unknown as typeof fetch;
    await expect(
      engine_api_client.getHeldPayments({
        customer_id: 'CUS-1004',
        call_id: CALL_ID,
      }),
    ).rejects.toMatchObject({
      error_code: 'ENGINE_API_UNAVAILABLE',
    });
  });
});
