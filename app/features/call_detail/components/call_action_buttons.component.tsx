"use client";

import { useState } from "react";

import type { LiveCall } from "@/shared/types/call.type";
import { Button } from "@/shared/ui/button.component";

import { useSupervisorActions } from "../hooks/use_supervisor_actions.hook";
import { HandbackDialog } from "./handback_dialog.component";

/** Take over, hand back and end call. Which ones are offered depends on who has the call. */
export function CallActionButtons({ call }: { call: LiveCall }) {
  const [is_handback_open, setIsHandbackOpen] = useState(false);
  const supervisor_actions = useSupervisorActions(call.call_id);

  if (call.status === "ENDED") {
    return null;
  }

  const confirmHandback = async (handback_note: string) => {
    if (await supervisor_actions.handBack(handback_note)) {
      setIsHandbackOpen(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      {call.status === "HUMAN_ACTIVE" ? (
        <Button variant="primary" disabled={supervisor_actions.is_busy} onClick={() => setIsHandbackOpen(true)}>
          Hand back to AI
        </Button>
      ) : (
        <Button variant="primary" disabled={supervisor_actions.is_busy} onClick={() => void supervisor_actions.takeOver()}>
          Take over
        </Button>
      )}
      <Button variant="danger" disabled={supervisor_actions.is_busy} onClick={() => void supervisor_actions.endCall()}>
        End call
      </Button>
      {is_handback_open ? (
        <HandbackDialog is_busy={supervisor_actions.is_busy} onConfirm={(handback_note) => void confirmHandback(handback_note)} onClose={() => setIsHandbackOpen(false)} />
      ) : null}
    </div>
  );
}
