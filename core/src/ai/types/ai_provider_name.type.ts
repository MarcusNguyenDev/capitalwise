// Adding a backend: one provider file plus one entry here and in the
// provider list of ai.module.ts.
export const AI_PROVIDER_NAMES = [
  'ollama',
  'vllm',
  'openai',
  'speaches',
] as const;

export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

export function isAiProviderName(value: string): value is AiProviderName {
  return (AI_PROVIDER_NAMES as readonly string[]).includes(value);
}
