import type { RiskClass } from "@/shared/types/case.type";
import type { AutonomyProposal, StaffStatus } from "@/shared/types/resources.type";
import type { ChipTone } from "@/shared/ui/chip.component";

export const RESOURCE_TABS = [
  { key: "WORKFORCE", label: "Workforce" },
  { key: "ROUTING", label: "Routing" },
  { key: "REGISTRY", label: "Policies and actions" },
  { key: "PROMPTS", label: "Prompt versions" },
  { key: "AUTONOMY", label: "Earned autonomy" },
] as const;

export type ResourceTabKey = (typeof RESOURCE_TABS)[number]["key"];

export const STAFF_STATUSES: readonly StaffStatus[] = ["AVAILABLE", "BUSY", "ON_BREAK", "OFFLINE"];

export const STAFF_STATUS_DOT_CLASS_NAMES: Record<StaffStatus, string> = {
  AVAILABLE: "bg-positive",
  BUSY: "bg-accent",
  ON_BREAK: "bg-warning",
  OFFLINE: "bg-ink-faint",
};

export const RISK_CLASS_TONES: Record<RiskClass, ChipTone> = {
  LOW: "positive",
  MEDIUM: "warning",
  HIGH: "accent",
  CRITICAL: "dark",
};

export const PROPOSAL_STATUS_TONES: Record<AutonomyProposal["status"], ChipTone> = {
  PENDING_SIGN_OFF: "warning",
  SIGNED_OFF: "positive",
  DECLINED: "neutral",
};

export const PROPOSAL_STATUS_LABELS: Record<AutonomyProposal["status"], string> = {
  PENDING_SIGN_OFF: "Awaiting team-leader sign-off",
  SIGNED_OFF: "Signed off",
  DECLINED: "Declined",
};

export const TEAM_LEADER_ROLE = "TEAM_LEADER";

/** Utilisation at or above this share of capacity is shown as busy. */
export const HIGH_UTILISATION_RATIO = 0.8;
