"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button.component";

import { QUICK_INSTRUCTIONS } from "../constants/quick_instruction.constant";

interface WhisperBoxProps {
  is_disabled: boolean;
  onWhisper: (instruction: string) => Promise<boolean>;
}

/** A brief instruction the AI follows for the rest of the call. The customer never hears it. */
export function WhisperBox({ is_disabled, onWhisper }: WhisperBoxProps) {
  const [instruction, setInstruction] = useState("");

  const submitInstruction = async () => {
    const trimmed_instruction = instruction.trim();
    if (trimmed_instruction && (await onWhisper(trimmed_instruction))) {
      setInstruction("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="whitespace-nowrap font-semibold">Whisper to the AI</p>
        <p className="text-right text-sm text-ink-soft">Guides the conversation. Cannot override policy.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_INSTRUCTIONS.map((quick_instruction) => (
          <button
            key={quick_instruction}
            type="button"
            disabled={is_disabled}
            onClick={() => void onWhisper(quick_instruction)}
            className="rounded-full border border-line bg-white px-3 py-1 text-sm font-semibold text-ink-soft transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {quick_instruction}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(submit_event) => {
          submit_event.preventDefault();
          void submitInstruction();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 outline-none focus:border-accent"
          placeholder="For example: slow down, she sounds confused"
          value={instruction}
          disabled={is_disabled}
          onChange={(change_event) => setInstruction(change_event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={is_disabled || instruction.trim() === ""}>
          Whisper
        </Button>
      </form>
    </div>
  );
}
