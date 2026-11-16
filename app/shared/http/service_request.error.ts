export interface ServiceRequestErrorDetails {
  status_code: number;
  error_code: string;
  message: string;
}

/** A failed call to the `api` or `core` service, carrying the service's own error code. */
export class ServiceRequestError extends Error {
  readonly status_code: number;
  readonly error_code: string;

  constructor(details: ServiceRequestErrorDetails) {
    super(details.message);
    this.name = "ServiceRequestError";
    this.status_code = details.status_code;
    this.error_code = details.error_code;
  }
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}
