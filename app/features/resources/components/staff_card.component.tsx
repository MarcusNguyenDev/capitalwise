"use client";

import { useState } from "react";

import { updateStaffStatus } from "@/shared/api_client/engine_api.client";
import { formatCodeLabel } from "@/shared/format/format_values.util";
import { describeError } from "@/shared/http/service_request.error";
import type { StaffMember, StaffStatus } from "@/shared/types/resources.type";
import { Chip } from "@/shared/ui/chip.component";
import { useToast } from "@/shared/ui/toast.provider";

import { STAFF_STATUS_DOT_CLASS_NAMES, STAFF_STATUSES } from "../constants/resources_view.constant";

import { UtilisationBar } from "./utilisation_bar.component";

export function StaffCard({ staff_member, onStatusChanged }: { staff_member: StaffMember; onStatusChanged: () => void }) {
  const { showToast } = useToast();
  const [is_updating, setIsUpdating] = useState(false);

  const changeStatus = async (status: StaffStatus) => {
    setIsUpdating(true);
    try {
      await updateStaffStatus(staff_member.staff_id, status);
      onStatusChanged();
    } catch (error) {
      showToast({ title: `Could not update ${staff_member.name}`, description: describeError(error), tone: "error" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">{staff_member.name}</h3>
          <p className="text-ink-soft">{formatCodeLabel(staff_member.role)}</p>
        </div>
        <label className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${STAFF_STATUS_DOT_CLASS_NAMES[staff_member.status] ?? "bg-ink-faint"}`} />
          <select
            aria-label={`Status of ${staff_member.name}`}
            className="rounded-lg border border-line bg-white px-2 py-1.5 font-semibold"
            value={staff_member.status}
            disabled={is_updating}
            onChange={(change_event) => void changeStatus(change_event.target.value as StaffStatus)}
          >
            {STAFF_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatCodeLabel(status)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {staff_member.skills.map((skill) => (
          <Chip key={skill} tone="info">
            {formatCodeLabel(skill)}
          </Chip>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-6">
        <UtilisationBar label="Supervised calls" used_count={staff_member.supervised_call_count} capacity={staff_member.max_concurrent_supervision} />
        <p className="text-right">
          <span key={staff_member.assigned_case_count} className="block animate-highlight rounded text-2xl font-black tabular-nums">
            {staff_member.assigned_case_count}
          </span>
          <span className="text-sm font-semibold uppercase tracking-wide text-ink-faint">assigned cases</span>
        </p>
      </div>
    </section>
  );
}
