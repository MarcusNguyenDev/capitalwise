import { AiProviderRequestFailedError } from '../errors/ai_provider_request_failed.error';
import { AiRequestAbortedError } from '../errors/ai_request_aborted.error';
import { IdleWatchdog } from './idle.watchdog';

const ERROR_BODY_PREVIEW_LENGTH = 300;

export interface ProviderHttpRequest {
  provider_name: string;
  url: string;
  method: 'GET' | 'POST';
  api_key?: string;
  json_body?: unknown;
  form_body?: FormData;
  timeout_ms: number;
  // Streamed requests: the timeout restarts on every chunk instead.
  idle_watchdog?: IdleWatchdog;
  abort_signal?: AbortSignal;
}

function buildHeaders(provider_request: ProviderHttpRequest): HeadersInit {
  const headers: Record<string, string> = {};
  if (provider_request.api_key) {
    headers.Authorization = `Bearer ${provider_request.api_key}`;
  }
  if (provider_request.json_body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

function buildSignal(provider_request: ProviderHttpRequest): AbortSignal {
  const timeout_signal =
    provider_request.idle_watchdog?.signal ??
    AbortSignal.timeout(provider_request.timeout_ms);
  return provider_request.abort_signal
    ? AbortSignal.any([provider_request.abort_signal, timeout_signal])
    : timeout_signal;
}

async function readErrorPreview(response: Response): Promise<string> {
  const response_text = await response.text().catch(() => '');
  const compact_text = response_text.replace(/\s+/g, ' ').trim();
  return compact_text.slice(0, ERROR_BODY_PREVIEW_LENGTH);
}

// One fetch with a timeout and the caller's abort signal. A deliberate abort
// becomes AiRequestAbortedError; everything else AiProviderRequestFailedError.
export async function sendProviderRequest(
  provider_request: ProviderHttpRequest,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(provider_request.url, {
      method: provider_request.method,
      headers: buildHeaders(provider_request),
      body:
        provider_request.form_body ??
        (provider_request.json_body === undefined
          ? undefined
          : JSON.stringify(provider_request.json_body)),
      signal: buildSignal(provider_request),
    });
  } catch (error) {
    throw mapProviderFetchError(provider_request, error);
  }
  if (!response.ok) {
    const error_preview = await readErrorPreview(response);
    throw new AiProviderRequestFailedError(
      provider_request.provider_name,
      `HTTP ${response.status} from ${provider_request.url}${error_preview ? `: ${error_preview}` : ''}`,
    );
  }
  return response;
}

// Also used while a streamed body is being read.
export function mapProviderFetchError(
  provider_request: Pick<
    ProviderHttpRequest,
    'provider_name' | 'url' | 'timeout_ms' | 'abort_signal'
  >,
  error: unknown,
): Error {
  if (
    error instanceof AiProviderRequestFailedError ||
    error instanceof AiRequestAbortedError
  ) {
    return error;
  }
  if (provider_request.abort_signal?.aborted) {
    return new AiRequestAbortedError(provider_request.provider_name);
  }
  const error_name = (error as Error)?.name;
  if (error_name === 'TimeoutError' || error_name === 'AbortError') {
    return new AiProviderRequestFailedError(
      provider_request.provider_name,
      `no answer from ${provider_request.url} for ${provider_request.timeout_ms} ms`,
    );
  }
  const cause_message = (error as { cause?: { message?: string } })?.cause
    ?.message;
  return new AiProviderRequestFailedError(
    provider_request.provider_name,
    `${provider_request.url} could not be reached (${cause_message ?? (error as Error)?.message ?? String(error)})`,
  );
}
