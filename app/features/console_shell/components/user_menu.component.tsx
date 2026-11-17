"use client";

import { ChevronDown, Keyboard, RotateCcw, Smartphone } from "lucide-react";

import { useDemoConfig } from "@/shared/demo/demo_config.provider";
import { formatCodeLabel } from "@/shared/format/format_values.util";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import { STAFF_STATUS_LABELS, STAFF_STATUSES } from "@/shared/staff/staff_status.constant";
import { useStaffStatusChange } from "@/shared/staff/use_staff_status_change.hook";
import type { StaffStatus } from "@/shared/types/resources.type";
import { DropdownMenu, MenuItem, MenuRadioGroup, MenuSeparator } from "@/shared/ui/dropdown_menu.component";

import { CUSTOMER_PHONE_PATH } from "../constants/navigation.constant";
import { StaffAvatar } from "./staff_avatar.component";

interface UserMenuProps {
  onOpenShortcuts: () => void;
  onResetDemo: () => void;
}

/** Who is signed in, their availability, and the demo-only controls kept out of the main path. */
export function UserMenu({ onOpenShortcuts, onResetDemo }: UserMenuProps) {
  const { staff_members, current_staff, current_staff_id, selectStaff } = useCurrentStaff();
  const { is_demo_mode } = useDemoConfig();
  const { changeStaffStatus } = useStaffStatusChange();
  const staff_name = current_staff?.name ?? "Alex Chen";

  return (
    <DropdownMenu
      side="top"
      align="start"
      trigger={
        <button type="button" className="flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-canvas" aria-label={`Account: ${staff_name}`}>
          <StaffAvatar name={staff_name} status={current_staff?.status ?? null} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{staff_name}</span>
            <span className="block truncate text-xs text-ink-faint">
              {current_staff ? `${formatCodeLabel(current_staff.role)} · ${STAFF_STATUS_LABELS[current_staff.status]}` : "Team leader"}
            </span>
          </span>
          <ChevronDown className="size-4 text-ink-faint" aria-hidden />
        </button>
      }
    >
      {current_staff ? (
        <MenuRadioGroup
          label="Your status"
          value={current_staff.status}
          options={STAFF_STATUSES.map((status) => ({ value: status, label: STAFF_STATUS_LABELS[status] }))}
          onChange={(status) => void changeStaffStatus(current_staff, status as StaffStatus)}
        />
      ) : null}
      <MenuSeparator />
      <MenuRadioGroup
        label="Act as (demo)"
        value={current_staff_id}
        options={staff_members.map((staff_member) => ({
          value: staff_member.staff_id,
          label: staff_member.name,
          description: formatCodeLabel(staff_member.role),
        }))}
        onChange={selectStaff}
      />
      <MenuSeparator />
      <MenuItem icon={<Keyboard />} hint="?" onSelect={onOpenShortcuts}>
        Keyboard shortcuts
      </MenuItem>
      <MenuItem icon={<Smartphone />} onSelect={() => window.open(CUSTOMER_PHONE_PATH, "_blank", "noopener")}>
        Open the customer phone
      </MenuItem>
      {is_demo_mode ? (
        <>
          <MenuSeparator />
          <MenuItem icon={<RotateCcw />} is_destructive onSelect={onResetDemo}>
            Reset demo data…
          </MenuItem>
        </>
      ) : null}
    </DropdownMenu>
  );
}
