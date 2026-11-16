import { ChatMessage } from '../ai/types/chat_request.type';

export const DEFAULT_HISTORY_LIMIT = 30;

// The model's view of the call: customer turns, its own replies and tool
// calls, tool results and supervisor instructions. Only the most recent
// messages are sent; the system prompt always goes first and stays
// byte-identical so a backend can reuse its cached prompt prefix.
export class ConversationHistory {
  private readonly messages: ChatMessage[] = [];

  constructor(private readonly history_limit = DEFAULT_HISTORY_LIMIT) {}

  add(chat_message: ChatMessage): void {
    this.messages.push(chat_message);
  }

  addSupervisorInstruction(instruction_text: string): void {
    this.add({
      role: 'system',
      content: `Supervisor instruction: ${instruction_text}`,
    });
  }

  buildChatMessages(system_prompt: string): ChatMessage[] {
    let recent_messages = this.messages.slice(-this.history_limit);
    // A tool result whose assistant tool call was cut off is rejected by
    // OpenAI-style APIs, so the window never starts with one.
    while (recent_messages.length > 0 && recent_messages[0].role === 'tool') {
      recent_messages = recent_messages.slice(1);
    }
    return [{ role: 'system', content: system_prompt }, ...recent_messages];
  }

  get message_count(): number {
    return this.messages.length;
  }
}
