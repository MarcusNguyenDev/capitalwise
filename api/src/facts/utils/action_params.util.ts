import { InvalidActionParamError } from '../errors/invalid_action_param.error';
import { MissingActionParamError } from '../errors/missing_action_param.error';

// Reads the model's params. They only say WHAT a request is about; every id
// is checked against the bank afterwards.

export function readStringParam(
  params: Record<string, unknown>,
  param_name: string,
): string | null {
  const param_value = params[param_name];
  return typeof param_value === 'string' && param_value.trim() !== ''
    ? param_value.trim()
    : null;
}

export function requireStringParam(
  action_code: string,
  params: Record<string, unknown>,
  param_name: string,
): string {
  const param_value = readStringParam(params, param_name);
  if (!param_value) {
    throw new MissingActionParamError(action_code, param_name);
  }
  return param_value;
}

// Case-insensitive; returns the canonical upper-case value.
export function requireEnumParam(
  action_code: string,
  params: Record<string, unknown>,
  param_name: string,
  allowed_values: string[],
): string {
  const param_value = requireStringParam(
    action_code,
    params,
    param_name,
  ).toUpperCase();
  if (!allowed_values.includes(param_value)) {
    throw new InvalidActionParamError(
      action_code,
      param_name,
      `one of ${allowed_values.join(', ')}`,
    );
  }
  return param_value;
}

export function requireIntegerParam(
  action_code: string,
  params: Record<string, unknown>,
  bounds: { param_name: string; min: number; max: number },
): number {
  const raw_value = params[bounds.param_name];
  if (raw_value === undefined || raw_value === null || raw_value === '') {
    throw new MissingActionParamError(action_code, bounds.param_name);
  }
  const param_value = Number(raw_value);
  if (
    !Number.isInteger(param_value) ||
    param_value < bounds.min ||
    param_value > bounds.max
  ) {
    throw new InvalidActionParamError(
      action_code,
      bounds.param_name,
      `a whole number from ${bounds.min} to ${bounds.max}`,
    );
  }
  return param_value;
}

export function readPositiveAmountParam(
  action_code: string,
  params: Record<string, unknown>,
  param_name: string,
): number | null {
  const raw_value = params[param_name];
  if (raw_value === undefined || raw_value === null || raw_value === '') {
    return null;
  }
  const amount = Number(raw_value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new InvalidActionParamError(
      action_code,
      param_name,
      'a positive amount in dollars',
    );
  }
  return Math.round(amount * 100) / 100;
}

export function readBooleanParam(
  action_code: string,
  params: Record<string, unknown>,
  param_name: string,
): boolean | null {
  const raw_value = params[param_name];
  if (raw_value === undefined || raw_value === null) {
    return null;
  }
  if (typeof raw_value !== 'boolean') {
    throw new InvalidActionParamError(action_code, param_name, 'true or false');
  }
  return raw_value;
}
