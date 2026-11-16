const BANK_NAME_PLACEHOLDER = /\{BANK_NAME\}/g;

export function renderPrompt(
  prompt_content: string,
  bank_name: string,
): string {
  return prompt_content.replace(BANK_NAME_PLACEHOLDER, bank_name);
}
