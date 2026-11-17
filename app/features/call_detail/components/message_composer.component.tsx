"use client";

import { Send } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode, RefObject } from "react";

import { Button } from "@/shared/ui/button.component";

interface MessageComposerProps {
  label: string;
  placeholder: string;
  helper: ReactNode;
  send_label: string;
  is_disabled: boolean;
  input_ref: RefObject<HTMLInputElement | null>;
  /** Extra controls on the right of the input, such as the microphone. */
  trailing?: ReactNode;
  onSend: (text: string) => Promise<boolean>;
}

/** A single-line message box under the transcript. Enter sends; the box clears only once the send worked. */
export function MessageComposer({ label, placeholder, helper, send_label, is_disabled, input_ref, trailing, onSend }: MessageComposerProps) {
  const [text, setText] = useState("");
  const input_id = useId();

  const submitText = async () => {
    const trimmed_text = text.trim();
    if (trimmed_text && (await onSend(trimmed_text))) {
      setText("");
    }
  };

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(submit_event) => {
        submit_event.preventDefault();
        void submitText();
      }}
    >
      <label htmlFor={input_id} className="sr-only">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={input_id}
          ref={input_ref}
          className="h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-white px-3 text-sm placeholder:text-ink-faint"
          placeholder={placeholder}
          value={text}
          autoComplete="off"
          onChange={(change_event) => setText(change_event.target.value)}
        />
        <Button type="submit" icon={<Send className="size-4" aria-hidden />} disabled={is_disabled || text.trim() === ""}>
          {send_label}
        </Button>
        {trailing}
      </div>
      <p className="text-xs text-ink-faint">{helper}</p>
    </form>
  );
}
