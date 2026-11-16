import { randomBytes } from 'node:crypto';

// For backends (older Ollama) that return tool calls without an id.
export function createToolCallId(): string {
  return `call_${randomBytes(8).toString('hex')}`;
}
