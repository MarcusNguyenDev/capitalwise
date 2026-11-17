import { STAFF_STATUS_DOT_CLASS_NAMES } from "@/shared/staff/staff_status.constant";
import type { StaffStatus } from "@/shared/types/resources.type";

function readInitials(name: string): string {
  return name
    .split(" ")
    .map((name_part) => name_part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function StaffAvatar({ name, status }: { name: string; status: StaffStatus | null }) {
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-ink-soft" aria-hidden>
      {readInitials(name)}
      {status ? <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-white ${STAFF_STATUS_DOT_CLASS_NAMES[status]}`} /> : null}
    </span>
  );
}
