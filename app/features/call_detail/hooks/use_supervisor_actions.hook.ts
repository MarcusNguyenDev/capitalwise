"use client";

import { useState } from "react";

import { recordIntervention, sendStaffMessage } from "@/shared/api_client/core_api.client";
import { describeError } from "@/shared/http/service_request.error";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { InterventionType } from "@/shared/types/call.type";
import { useToast } from "@/shared/ui/toast.provider";

const FAILURE_TITLES: Record<InterventionType, string> = {
  MONITOR: "Could not log monitoring",
  INSTRUCTION: "Could not send the instruction",
  TAKEOVER: "Could not take over the call",
  HANDBACK: "Could not hand the call back",
  END_CALL: "Could not end the call",
};

export interface SupervisorActions {
  is_busy: boolean;
  whisperInstruction: (instruction: string) => Promise<boolean>;
  takeOver: () => Promise<boolean>;
  handBack: (handback_note: string) => Promise<boolean>;
  endCall: () => Promise<boolean>;
  sendReply: (reply: string) => Promise<boolean>;
}

/** The supervisor's controls for one call, acting as the staff member selected in the header. */
export function useSupervisorActions(call_id: string): SupervisorActions {
  const [is_busy, setIsBusy] = useState(false);
  const { current_staff_id } = useCurrentStaff();
  const { showToast } = useToast();

  const runAction = async (failure_title: string, action: () => Promise<unknown>): Promise<boolean> => {
    setIsBusy(true);
    try {
      await action();
      return true;
    } catch (error) {
      showToast({ title: failure_title, description: describeError(error), tone: "error" });
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const intervene = (type: InterventionType, text?: string) =>
    runAction(FAILURE_TITLES[type], () => recordIntervention(call_id, { staff_id: current_staff_id, type, text }));

  return {
    is_busy,
    whisperInstruction: (instruction) => intervene("INSTRUCTION", instruction),
    takeOver: () => intervene("TAKEOVER"),
    handBack: (handback_note) => intervene("HANDBACK", handback_note),
    endCall: () => intervene("END_CALL"),
    sendReply: (reply) => runAction("Could not send the reply", () => sendStaffMessage(call_id, { staff_id: current_staff_id, text: reply })),
  };
}
