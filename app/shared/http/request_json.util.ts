import { ServiceRequestError } from "./service_request.error";

type QueryValue = string | number | boolean | null | undefined;

export interface JsonRequest {
  base_url: string;
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: object;
  body?: unknown;
}

function buildRequestUrl(request: JsonRequest): string {
  const search_params = new URLSearchParams();
  for (const [key, value] of Object.entries((request.query ?? {}) as Record<string, QueryValue>)) {
    if (value !== undefined && value !== null && value !== "") {
      search_params.set(key, String(value));
    }
  }
  const query_string = search_params.toString();
  return `${request.base_url}${request.path}${query_string ? `?${query_string}` : ""}`;
}

async function readErrorBody(response: Response): Promise<{ error_code: string; message: string }> {
  try {
    const error_body = await response.json();
    return {
      error_code: error_body.error_code ?? "UNKNOWN_ERROR",
      message: Array.isArray(error_body.message) ? error_body.message.join(", ") : (error_body.message ?? response.statusText),
    };
  } catch {
    return { error_code: "UNKNOWN_ERROR", message: response.statusText };
  }
}

export async function requestJson<ResponseBody>(request: JsonRequest): Promise<ResponseBody> {
  let response: Response;
  try {
    response = await fetch(buildRequestUrl(request), {
      method: request.method ?? "GET",
      headers: request.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      cache: "no-store",
    });
  } catch {
    throw new ServiceRequestError({
      status_code: 0,
      error_code: "SERVICE_UNREACHABLE",
      message: `Could not reach ${request.base_url}. Is the service running?`,
    });
  }

  if (!response.ok) {
    const error_body = await readErrorBody(response);
    throw new ServiceRequestError({ status_code: response.status, ...error_body });
  }
  return (await response.json()) as ResponseBody;
}
