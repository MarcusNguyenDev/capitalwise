"use client";

import { useState } from "react";

import { updateStaffStatus } from "@/shared/api_client/engine_api.client";
import { describeError } from "@/shared/http/service_request.error";
import type { StaffMember, StaffStatus } from "@/shared/types/resources.type";
import { useToast } from "@/shared/ui/toast.provider";

import { STAFF_STATUS_LABELS } from "./staff_status.constant";

/** Changes a staff member's availability, which decides who new escalations are routed to. */
export function useStaffStatusChange() {
  const [updating_staff_id, setUpdatingStaffId] = useState<string | null>(null);
  const { showToast } = useToast();

  const changeStaffStatus = async (staff_member: StaffMember, status: StaffStatus): Promise<boolean> => {
    setUpdatingStaffId(staff_member.staff_id);
    try {
      await updateStaffStatus(staff_member.staff_id, status);
      showToast({ title: `${staff_member.name} is now ${STAFF_STATUS_LABELS[status].toLowerCase()}`, tone: "success" });
      return true;
    } catch (error) {
      showToast({ title: `Could not update ${staff_member.name}`, description: describeError(error), tone: "error" });
      return false;
    } finally {
      setUpdatingStaffId(null);
    }
  };

  return { updating_staff_id, changeStaffStatus };
}
