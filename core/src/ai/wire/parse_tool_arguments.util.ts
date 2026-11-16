// Tool arguments arrive as an object (Ollama) or a JSON string (OpenAI-style).
// Anything unparseable becomes an empty object: the tool dispatcher then
// answers the model with a clear validation message.
export function parseToolArguments(
  raw_arguments: unknown,
): Record<string, unknown> {
  if (typeof raw_arguments === 'string') {
    if (raw_arguments.trim() === '') {
      return {};
    }
    try {
      return parseToolArguments(JSON.parse(raw_arguments));
    } catch {
      return {};
    }
  }
  if (
    raw_arguments !== null &&
    typeof raw_arguments === 'object' &&
    !Array.isArray(raw_arguments)
  ) {
    return raw_arguments as Record<string, unknown>;
  }
  return {};
}
