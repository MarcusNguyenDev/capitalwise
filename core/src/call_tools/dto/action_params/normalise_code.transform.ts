import { TransformFnParams } from 'class-transformer';

// Models write codes loosely ("lost", "change address"); the api reads them
// case-insensitively, so they are normalised to UPPER_SNAKE_CASE first.
export function normaliseCode({ value }: TransformFnParams): unknown {
  return typeof value === 'string'
    ? value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
    : value;
}
