"use client";

import type { RefObject } from "react";

import { KeyboardKey } from "@/shared/ui/keyboard_key.component";

import { QUICK_INSTRUCTIONS } from "../constants/quick_instruction.constant";
import { MessageComposer } from "./message_composer.component";

interface WhisperComposerProps {
  is_disabled: boolean;
  input_ref: RefObject<HTMLInputElement | null>;
  onWhisper: (instruction: string) => Promise<boolean>;
}

/** While the AI has the call: a short instruction it follows for the rest of the call. The customer never hears it. */
export function WhisperComposer({ is_disabled, input_ref, onWhisper }: WhisperComposerProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-line bg-white px-5 py-3">
      <div className="flex items-center gap-2">
        <p className="shrink-0 text-xs font-semibold text-ink-soft">Whisper to the AI</p>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Quick instructions">
          {QUICK_INSTRUCTIONS.map((quick_instruction) => (
            <button
              key={quick_instruction}
              type="button"
              disabled={is_disabled}
              onClick={() => void onWhisper(quick_instruction)}
              className="h-7 shrink-0 whitespace-nowrap rounded-full border border-line px-2.5 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {quick_instruction}
            </button>
          ))}
        </div>
      </div>
      <MessageComposer
        label="Whisper to the AI"
        placeholder="For example: slow down, she sounds confused"
        send_label="Whisper"
        is_disabled={is_disabled}
        input_ref={input_ref}
        onSend={onWhisper}
        helper={
          <>
            Only the AI hears this. It guides the conversation but cannot override policy. Press <KeyboardKey>W</KeyboardKey> to type here.
          </>
        }
      />
    </div>
  );
}
