"use client";

import { StaffAvatar } from "@/features/console_shell/components/staff_avatar.component";
import { formatCodeLabel } from "@/shared/format/format_values.util";
import { STAFF_STATUS_LABELS, STAFF_STATUSES } from "@/shared/staff/staff_status.constant";
import { useStaffStatusChange } from "@/shared/staff/use_staff_status_change.hook";
import type { StaffMember, StaffStatus } from "@/shared/types/resources.type";
import { Badge } from "@/shared/ui/badge.component";
import { DataTable } from "@/shared/ui/data_table.component";

import { UtilisationBar } from "./utilisation_bar.component";

/** Every specialist: what they can handle, whether they are available, and how loaded they are. */
export function StaffTable({ staff_members }: { staff_members: StaffMember[] }) {
  const { updating_staff_id, changeStaffStatus } = useStaffStatusChange();

  return (
    <DataTable<StaffMember>
      caption="Specialists"
      rows={staff_members}
      readRowKey={(staff_member) => staff_member.staff_id}
      columns={[
        {
          key: "name",
          header: "Specialist",
          renderCell: (staff_member) => (
            <span className="flex items-center gap-2.5">
              <StaffAvatar name={staff_member.name} status={staff_member.status} />
              <span>
                <span className="block font-medium">{staff_member.name}</span>
                <span className="block text-xs text-ink-faint">{formatCodeLabel(staff_member.role)}</span>
              </span>
            </span>
          ),
        },
        {
          key: "skills",
          header: "Skills",
          renderCell: (staff_member) => (
            <span className="flex flex-wrap gap-1">
              {staff_member.skills.map((skill) => (
                <Badge key={skill}>{formatCodeLabel(skill)}</Badge>
              ))}
            </span>
          ),
        },
        {
          key: "status",
          header: "Status",
          renderCell: (staff_member) => (
            <select
              aria-label={`Status of ${staff_member.name}`}
              className="h-8 rounded-md border border-line-strong bg-white px-2 text-sm"
              value={staff_member.status}
              disabled={updating_staff_id === staff_member.staff_id}
              onChange={(change_event) => void changeStaffStatus(staff_member, change_event.target.value as StaffStatus)}
            >
              {STAFF_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STAFF_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          ),
        },
        {
          key: "calls",
          header: "Supervised calls",
          renderCell: (staff_member) => (
            <UtilisationBar label={`Calls supervised by ${staff_member.name}`} used_count={staff_member.supervised_call_count} capacity={staff_member.max_concurrent_supervision} />
          ),
        },
        {
          key: "cases",
          header: "Assigned cases",
          is_numeric: true,
          renderCell: (staff_member) => (
            <span key={staff_member.assigned_case_count} className="animate-highlight rounded px-1 font-medium">
              {staff_member.assigned_case_count}
            </span>
          ),
        },
      ]}
    />
  );
}
