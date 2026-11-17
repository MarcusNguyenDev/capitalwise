import { AudioLines, MessageSquareText, UserRoundCheck } from "lucide-react";
import Image from "next/image";

import type { LiveCall } from "@/shared/types/call.type";
import { Button } from "@/shared/ui/button.component";
import { KeyboardKey } from "@/shared/ui/keyboard_key.component";

/** The detail pane before a call is open: offers the most useful next call, and the keyboard route. */
export function NoCallSelected({ next_attention_call, onOpen }: { next_attention_call: LiveCall | null; onOpen: (call_id: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center sm:px-10">
      <div className="mb-6 flex size-28 shrink-0 items-center justify-center rounded-full bg-brand-soft">
        <Image src="/brand/westpac-headset.svg" width={70} height={70} alt="" />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-faint">Human care. AI support.</p>
      <h2 className="mt-3 max-w-md text-2xl font-bold leading-tight tracking-tight text-brand-deep">
        {next_attention_call ? `${next_attention_call.customer_name ?? "A caller"} is waiting for a person` : "A better conversation starts here."}
      </h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
        Open a call to see the customer’s story, follow the conversation and give your AI specialist a helping hand.
      </p>
      {next_attention_call ? (
        <Button className="mt-6" variant="primary" onClick={() => onOpen(next_attention_call.call_id)}>
          Open {next_attention_call.customer_name ?? "the call"}
        </Button>
      ) : null}
      <div className="mt-8 grid w-full max-w-lg grid-cols-3 gap-3 border-y border-line py-5 text-xs font-medium text-brand-deep">
        <span className="flex flex-col items-center gap-2"><AudioLines className="size-5" aria-hidden />Listen in</span>
        <span className="flex flex-col items-center gap-2"><MessageSquareText className="size-5" aria-hidden />Whisper guidance</span>
        <span className="flex flex-col items-center gap-2"><UserRoundCheck className="size-5" aria-hidden />Take over</span>
      </div>
      <p className="mt-5 flex flex-wrap items-center justify-center gap-1.5 text-xs text-ink-faint">
        <KeyboardKey>J</KeyboardKey><KeyboardKey>K</KeyboardKey> to move through calls <span className="mx-1">·</span><KeyboardKey>Enter</KeyboardKey> to open
      </p>
    </div>
  );
}
