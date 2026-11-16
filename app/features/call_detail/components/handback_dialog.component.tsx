"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button.component";
import { Modal } from "@/shared/ui/modal.component";

import { DEFAULT_HANDBACK_NOTE } from "../constants/quick_instruction.constant";

interface HandbackDialogProps {
  is_busy: boolean;
  onConfirm: (handback_note: string) => void;
  onClose: () => void;
}

/** Asks for the one-line note the AI receives when it gets the call back. */
export function HandbackDialog({ is_busy, onConfirm, onClose }: HandbackDialogProps) {
  const [handback_note, setHandbackNote] = useState(DEFAULT_HANDBACK_NOTE);
  const trimmed_note = handback_note.trim();

  return (
    <Modal
      title="Hand back to the AI specialist"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={is_busy || trimmed_note === ""} onClick={() => onConfirm(trimmed_note)}>
            Hand back
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-2">
        <span className="font-semibold">Handback note</span>
        <textarea
          className="rounded-lg border border-line px-3 py-2 text-lg outline-none focus:border-accent"
          rows={3}
          value={handback_note}
          onChange={(change_event) => setHandbackNote(change_event.target.value)}
        />
      </label>
      <p className="mt-3 text-ink-soft">
        The AI gets this note as a supervisor instruction and resumes the call. It guides the conversation but cannot override policy.
      </p>
    </Modal>
  );
}
