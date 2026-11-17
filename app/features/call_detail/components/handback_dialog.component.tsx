"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button.component";
import { Dialog } from "@/shared/ui/dialog.component";

import { DEFAULT_HANDBACK_NOTE } from "../constants/quick_instruction.constant";

interface HandbackDialogProps {
  is_open: boolean;
  is_busy: boolean;
  onOpenChange: (is_open: boolean) => void;
  onConfirm: (handback_note: string) => void;
}

/** Asks for the one-line note the AI receives when it gets the call back. */
export function HandbackDialog({ is_open, is_busy, onOpenChange, onConfirm }: HandbackDialogProps) {
  const [handback_note, setHandbackNote] = useState(DEFAULT_HANDBACK_NOTE);
  const trimmed_note = handback_note.trim();

  return (
    <Dialog
      is_open={is_open}
      onOpenChange={onOpenChange}
      title="Hand the call back to the AI"
      description="The AI reads your note as an instruction and carries on the call. It guides the conversation but cannot override policy."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Keep the call</Button>
          <Button variant="primary" is_loading={is_busy} disabled={trimmed_note === ""} onClick={() => onConfirm(trimmed_note)}>
            Hand back
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Note for the AI</span>
        <textarea
          className="rounded-md border border-line-strong px-3 py-2 text-sm"
          rows={3}
          value={handback_note}
          onChange={(change_event) => setHandbackNote(change_event.target.value)}
        />
      </label>
    </Dialog>
  );
}
