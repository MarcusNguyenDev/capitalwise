import { UnprocessableEntityException } from '@nestjs/common';

// Raised by a tool handler to answer the model with `ok: false`. The message
// is written for the model: it says what to do next.
export class ToolRejectedError extends UnprocessableEntityException {
  readonly error_code: string;

  constructor(error_code: string, message_for_model: string) {
    super(message_for_model);
    this.error_code = error_code;
  }
}
