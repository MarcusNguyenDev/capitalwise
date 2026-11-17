import { AiProviderRequestFailedError } from '../errors/ai_provider_request_failed.error';
import { redactSecrets } from './redact_secrets.util';

describe('redactSecrets', () => {
  it('masks API keys and bearer tokens in provider error messages', () => {
    expect(
      redactSecrets(
        'Incorrect API key provided: sk-proj-abc123DEF456****wxyz. Header Bearer sk-live-0123456789',
      ),
    ).toBe('Incorrect API key provided: sk-***. Header Bearer ***');
  });

  it('is applied to every provider request error', () => {
    const provider_error = new AiProviderRequestFailedError(
      'openai',
      'HTTP 401: Incorrect API key provided: sk-proj-zz99yy88xx77',
    );

    expect(provider_error.message).not.toContain('zz99yy88');
    expect(provider_error.message).toContain('sk-***');
  });
});
