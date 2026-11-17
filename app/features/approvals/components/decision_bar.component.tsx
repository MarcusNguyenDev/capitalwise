"use client";

import { Check, PencilLine, X } from "lucide-react";

import type { CaseDecision } from "@/shared/types/case.type";
import { Button } from "@/shared/ui/button.component";
import { KeyboardKey } from "@/shared/ui/keyboard_key.component";

interface DecisionBarProps {
  staff_name: string;
  can_edit: boolean;
  onChoose: (decision: CaseDecision) => void;
}

/** Always at the bottom of an undecided case: Approve is the primary action, Reject the destructive one. */
export function DecisionBar({ staff_name, can_edit, onChoose }: DecisionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-5 py-3">
      <p className="text-sm text-ink-soft">
        Deciding as <span className="font-semibold text-ink">{staff_name}</span>
        <span className="hidden xl:inline">
          {" "}
          · <KeyboardKey>A</KeyboardKey> approve{can_edit ? <> · <KeyboardKey>E</KeyboardKey> edit</> : null} · <KeyboardKey>R</KeyboardKey> reject
        </span>
      </p>
      <div className="flex gap-2">
        <Button variant="danger" icon={<X className="size-4" aria-hidden />} onClick={() => onChoose("REJECTED")}>
          Reject…
        </Button>
        {can_edit ? (
          <Button icon={<PencilLine className="size-4" aria-hidden />} onClick={() => onChoose("EDITED_AND_APPROVED")}>
            Edit and approve…
          </Button>
        ) : null}
        <Button variant="primary" icon={<Check className="size-4" aria-hidden />} onClick={() => onChoose("APPROVED")}>
          Approve…
        </Button>
      </div>
    </div>
  );
}
