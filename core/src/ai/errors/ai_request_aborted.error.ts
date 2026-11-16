import { HttpException } from '@nestjs/common';

const CLIENT_CLOSED_REQUEST_STATUS = 499;

// The caller cancelled the request on purpose (barge-in, takeover, hang-up).
export class AiRequestAbortedError extends HttpException {
  readonly error_code = 'AI_REQUEST_ABORTED';

  constructor(provider_name: string) {
    super(
      `The ${provider_name} request was cancelled.`,
      CLIENT_CLOSED_REQUEST_STATUS,
    );
  }
}
