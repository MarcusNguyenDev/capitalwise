// Provider error bodies can quote credentials (OpenAI's 401 names part of the
// key it rejected). Anything that looks like a key or bearer token is masked
// before an error message is logged or returned.
const SECRET_PATTERNS = [
  /\b(sk|rk|pk)-[A-Za-z0-9_*-]{6,}/g,
  /\b(Bearer)\s+[A-Za-z0-9_*.~+/=-]{6,}/gi,
];

export function redactSecrets(message: string): string {
  return SECRET_PATTERNS.reduce(
    (redacted_message, secret_pattern) =>
      redacted_message.replace(secret_pattern, (_secret, prefix: string) =>
        prefix.toLowerCase() === 'bearer' ? `${prefix} ***` : `${prefix}-***`,
      ),
    message,
  );
}
