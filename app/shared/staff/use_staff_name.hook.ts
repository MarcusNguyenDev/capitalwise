"use client";

import { useCurrentStaff } from "./current_staff.provider";

/** Turns a staff id such as "STF-01" into a name, falling back to the id while staff are loading. */
export function useStaffName(staff_id: string | null | undefined): string {
  const { staff_members } = useCurrentStaff();
  return staff_members.find((staff_member) => staff_member.staff_id === staff_id)?.name ?? staff_id ?? "–";
}
