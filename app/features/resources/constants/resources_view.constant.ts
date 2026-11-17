import type { RiskClass } from "@/shared/types/case.type";
import type { AutonomyProposal } from "@/shared/types/resources.type";
import type { BadgeTone } from "@/shared/ui/badge.component";

export const RISK_CLASS_TONES: Record<RiskClass, BadgeTone> = {
  LOW: "neutral",
  MEDIUM: "attention",
  HIGH: "danger",
  CRITICAL: "danger",
};

export const PROPOSAL_STATUS_TONES: Record<AutonomyProposal["status"], BadgeTone> = {
  PENDING_SIGN_OFF: "attention",
  SIGNED_OFF: "positive",
  DECLINED: "neutral",
};

export const PROPOSAL_STATUS_LABELS: Record<AutonomyProposal["status"], string> = {
  PENDING_SIGN_OFF: "Waiting for team-leader sign-off",
  SIGNED_OFF: "Signed off",
  DECLINED: "Declined",
};

export const TEAM_LEADER_ROLE = "TEAM_LEADER";

/** Utilisation at or above this share of capacity is shown as busy. */
export const HIGH_UTILISATION_RATIO = 0.8;
