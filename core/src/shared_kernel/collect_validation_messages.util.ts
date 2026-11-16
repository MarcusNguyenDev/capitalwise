import { ValidationError } from 'class-validator';

// Flattens class-validator errors, including nested objects, into messages.
export function collectValidationMessages(
  validation_errors: ValidationError[],
): string[] {
  return validation_errors.flatMap((validation_error) => [
    ...Object.values(validation_error.constraints ?? {}),
    ...collectValidationMessages(validation_error.children ?? []),
  ]);
}
