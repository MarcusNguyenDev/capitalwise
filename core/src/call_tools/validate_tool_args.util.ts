import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { collectValidationMessages } from '../shared_kernel/collect_validation_messages.util';

export type ToolArgsValidation<Args> =
  | { is_valid: true; tool_args: Args }
  | { is_valid: false; validation_messages: string[] };

// Unknown properties are stripped rather than rejected: whatever the model
// adds (a customer_id, for instance) is simply never used.
export async function validateToolArgs<Args extends object>(
  args_dto: new () => Args,
  raw_args: unknown,
): Promise<ToolArgsValidation<Args>> {
  if (
    raw_args === null ||
    typeof raw_args !== 'object' ||
    Array.isArray(raw_args)
  ) {
    return {
      is_valid: false,
      validation_messages: ['args must be a JSON object'],
    };
  }
  const tool_args = plainToInstance(args_dto, raw_args);
  const validation_errors = await validate(tool_args, {
    whitelist: true,
    forbidUnknownValues: false,
  });
  if (validation_errors.length > 0) {
    return {
      is_valid: false,
      validation_messages: collectValidationMessages(validation_errors),
    };
  }
  return { is_valid: true, tool_args };
}
