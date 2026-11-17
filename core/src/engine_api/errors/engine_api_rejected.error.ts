import { BadGatewayException } from '@nestjs/common';

interface EngineApiRejection {
  api_status_code: number;
  api_error_code: string;
  api_message: string;
  // Any other fields of the error body, e.g. { required_level, current_level }.
  api_details?: Record<string, unknown>;
}

// The api service answered with a 4xx business error ({ status_code, error_code, message }).
export class EngineApiRejectedError extends BadGatewayException {
  readonly error_code = 'ENGINE_API_REJECTED';
  readonly api_status_code: number;
  readonly api_error_code: string;
  readonly api_message: string;
  readonly api_details: Record<string, unknown>;

  constructor(rejection: EngineApiRejection) {
    super(`${rejection.api_error_code}: ${rejection.api_message}`);
    this.api_status_code = rejection.api_status_code;
    this.api_error_code = rejection.api_error_code;
    this.api_message = rejection.api_message;
    this.api_details = rejection.api_details ?? {};
  }
}
