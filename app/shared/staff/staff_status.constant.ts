import type { StaffStatus } from "@/shared/types/resources.type";
import type { BadgeTone } from "@/shared/ui/badge.component";

export const STAFF_STATUSES: readonly StaffStatus[] = ["AVAILABLE", "BUSY", "ON_BREAK", "OFFLINE"];

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  AVAILABLE: "Available",
  BUSY: "Busy",
  ON_BREAK: "On break",
  OFFLINE: "Offline",
};

export const STAFF_STATUS_TONES: Record<StaffStatus, BadgeTone> = {
  AVAILABLE: "positive",
  BUSY: "info",
  ON_BREAK: "attention",
  OFFLINE: "neutral",
};

export const STAFF_STATUS_DOT_CLASS_NAMES: Record<StaffStatus, string> = {
  AVAILABLE: "bg-positive",
  BUSY: "bg-info",
  ON_BREAK: "bg-warning",
  OFFLINE: "bg-ink-faint",
};
