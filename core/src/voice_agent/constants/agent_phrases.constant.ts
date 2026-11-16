// Fixed lines the voice agent says itself (not the model). Pre-rendered at
// startup with the hold lines.
export function buildGreeting(bank_name: string): string {
  return `Hello, you've reached ${bank_name}'s AI specialist. This call is recorded.`;
}

export const AGENT_PHRASES = {
  // Any provider failure during a turn; a person is then requested.
  TROUBLE_APOLOGY:
    "Sorry, I'm having trouble with that. Let me get someone from our team to help.",
  // The model kept calling tools without answering.
  TOOL_ROUNDS_FALLBACK:
    "Sorry, I couldn't finish that just now. Could you tell me again what you need?",
} as const;

export function buildHandoverLine(command_text: string | null): string {
  const handover_text = (
    command_text ?? "You're now speaking with someone from our team"
  ).trim();
  return /[.!?]$/.test(handover_text) ? handover_text : `${handover_text}.`;
}

export function listAgentPhrases(bank_name: string): string[] {
  return [
    buildGreeting(bank_name),
    AGENT_PHRASES.TROUBLE_APOLOGY,
    AGENT_PHRASES.TOOL_ROUNDS_FALLBACK,
  ];
}
