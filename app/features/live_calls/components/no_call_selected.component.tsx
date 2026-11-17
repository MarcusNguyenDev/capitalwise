import { Headphones } from "lucide-react";

import type { LiveCall } from "@/shared/types/call.type";
import { Button } from "@/shared/ui/button.component";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { KeyboardKey } from "@/shared/ui/keyboard_key.component";

/** The detail pane before a call is open: offers the most useful next call, and the keyboard route. */
export function NoCallSelected({ next_attention_call, onOpen }: { next_attention_call: LiveCall | null; onOpen: (call_id: string) => void }) {
  return (
    <EmptyState
      className="flex-1"
      icon={<Headphones aria-hidden />}
      title={next_attention_call ? `${next_attention_call.customer_name ?? "A caller"} is waiting for a person` : "Open a call to follow the conversation"}
      description={
        <>
          See the transcript, what the AI did and who the customer is, then whisper, listen or take over. Move through the queue with <KeyboardKey>J</KeyboardKey>{" "}
          <KeyboardKey>K</KeyboardKey> and open with <KeyboardKey>Enter</KeyboardKey>.
        </>
      }
      action={
        next_attention_call ? (
          <Button variant="primary" onClick={() => onOpen(next_attention_call.call_id)}>
            Open {next_attention_call.customer_name ?? "the call"}
          </Button>
        ) : null
      }
    />
  );
}
