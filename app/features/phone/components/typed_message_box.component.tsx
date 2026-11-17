"use client";

import { Send } from "lucide-react";
import { useId, useState } from "react";

/** Mirrors the limit `core` accepts for one typed line. */
const MAX_TYPED_MESSAGE_LENGTH = 500;

interface TypedMessageBoxProps {
  onSend: (text: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * "Type instead": what the caller would say, typed, for a call without a
 * microphone or in a noisy room. Enter sends, Escape closes, and the box
 * clears once the line was sent. The line shows in the captions as the
 * caller's once `core` records it.
 */
export function TypedMessageBox({ onSend, onClose }: TypedMessageBoxProps) {
  const [text, setText] = useState("");
  const [is_sending, setIsSending] = useState(false);
  const input_id = useId();
  const trimmed_text = text.trim();

  const submitText = async () => {
    if (trimmed_text === "" || is_sending) {
      return;
    }
    setIsSending(true);
    const is_sent = await onSend(trimmed_text);
    setIsSending(false);
    if (is_sent) {
      setText("");
    }
  };

  return (
    <form
      className="mx-4 mt-2 flex animate-slide-in items-center gap-2 rounded-2xl bg-white/10 p-1.5 pl-3.5"
      onSubmit={(submit_event) => {
        submit_event.preventDefault();
        void submitText();
      }}
      onKeyDown={(key_event) => {
        if (key_event.key === "Escape") {
          onClose();
        }
      }}
    >
      <label htmlFor={input_id} className="sr-only">
        Type what you want to say to the AI specialist
      </label>
      <input
        id={input_id}
        // Opening the box is the tap that asks for the keyboard.
        autoFocus
        className="h-10 min-w-0 flex-1 bg-transparent text-white placeholder:text-white/55"
        placeholder="Type what you would say…"
        value={text}
        maxLength={MAX_TYPED_MESSAGE_LENGTH}
        autoComplete="off"
        enterKeyHint="send"
        onChange={(change_event) => setText(change_event.target.value)}
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={trimmed_text === "" || is_sending}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Send className="size-4" aria-hidden />
      </button>
    </form>
  );
}
