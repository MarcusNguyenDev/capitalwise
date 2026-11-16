import { InvalidCallScriptError } from './errors/invalid_call_script.error';
import { CallScript, ScriptStep } from './types/call_script.type';

const REQUIRED_STRING_FIELDS: Record<ScriptStep['type'], string[]> = {
  ai: ['text'],
  customer: ['text'],
  tool: ['tool_name'],
  insight: [],
  await_instruction: ['ai_with_instruction', 'ai_without_instruction'],
  await_takeover: ['ai_if_timeout'],
  pause: [],
};

const REQUIRED_NUMBER_FIELDS: Record<ScriptStep['type'], string[]> = {
  ai: [],
  customer: [],
  tool: [],
  insight: [],
  await_instruction: ['timeout_seconds'],
  await_takeover: ['timeout_seconds'],
  pause: ['seconds'],
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function findStepProblem(raw_step: unknown): string | null {
  const step = raw_step as Record<string, unknown> | null;
  const step_type = step?.type as ScriptStep['type'];
  if (!step || !(step_type in REQUIRED_STRING_FIELDS)) {
    return `unknown step type "${String(step?.type)}"`;
  }
  for (const field_name of REQUIRED_STRING_FIELDS[step_type]) {
    if (!isNonEmptyString(step[field_name])) {
      return `${step_type} step needs a "${field_name}" string`;
    }
  }
  for (const field_name of REQUIRED_NUMBER_FIELDS[step_type]) {
    if (
      typeof step[field_name] !== 'number' ||
      (step[field_name] as number) < 0
    ) {
      return `${step_type} step needs a non-negative "${field_name}" number`;
    }
  }
  return null;
}

// Fails loudly on a malformed script: a typo must surface at start-up, not
// halfway through a demo call.
export function parseCallScript(
  raw_script: unknown,
  script_label: string,
): CallScript {
  const script = raw_script as Partial<CallScript> | null;
  for (const field_name of [
    'script_id',
    'title',
    'customer_id',
    'caller_number',
  ] as const) {
    if (!isNonEmptyString(script?.[field_name])) {
      throw new InvalidCallScriptError(
        script_label,
        `"${field_name}" is missing`,
      );
    }
  }
  if (!Array.isArray(script?.steps) || script.steps.length === 0) {
    throw new InvalidCallScriptError(
      script_label,
      '"steps" must be a non-empty array',
    );
  }
  script.steps.forEach((raw_step, step_index) => {
    const step_problem = findStepProblem(raw_step);
    if (step_problem) {
      throw new InvalidCallScriptError(
        script_label,
        `step ${step_index + 1}: ${step_problem}`,
      );
    }
  });
  return {
    ...(script as CallScript),
    steps: script.steps.map((step) =>
      step.type === 'tool' ? { ...step, args: step.args ?? {} } : step,
    ),
  };
}
