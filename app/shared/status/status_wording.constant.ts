import type { CallStatus, RiskLevel, Sentiment } from "@/shared/types/call.type";
import type { CaseStatus, Recommendation } from "@/shared/types/case.type";
import type { BadgeTone } from "@/shared/ui/badge.component";

/** The one vocabulary every screen uses for who has a call. */
export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  AI_ACTIVE: "AI handling",
  NEEDS_ATTENTION: "Needs attention",
  HUMAN_ACTIVE: "Person on call",
  ENDED: "Ended",
};

export const CALL_STATUS_TONES: Record<CallStatus, BadgeTone> = {
  AI_ACTIVE: "positive",
  NEEDS_ATTENTION: "attention",
  HUMAN_ACTIVE: "info",
  ENDED: "neutral",
};

export const TIER_NAMES: Record<number, string> = { 1: "Auto", 2: "Approve", 3: "Escalate" };

export const TIER_DESCRIPTIONS: Record<number, string> = {
  1: "Low-risk and reversible: runs straight away.",
  2: "A person approves the AI's proposal before anything happens.",
  3: "Goes to a specialist. The AI never decides these.",
};

export const TIER_TONES: Record<number, BadgeTone> = { 1: "positive", 2: "info", 3: "attention" };

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  AUTO_EXECUTED: "Done automatically",
  PENDING_APPROVAL: "Waiting for approval",
  ESCALATED: "With a specialist",
  APPROVED: "Approved",
  EDITED_AND_APPROVED: "Approved with changes",
  REJECTED: "Rejected",
  EXECUTED: "Completed",
};

export const CASE_STATUS_TONES: Record<CaseStatus, BadgeTone> = {
  AUTO_EXECUTED: "positive",
  PENDING_APPROVAL: "info",
  ESCALATED: "attention",
  APPROVED: "positive",
  EDITED_AND_APPROVED: "positive",
  REJECTED: "neutral",
  EXECUTED: "positive",
};

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  APPROVE: "Recommends approve",
  DECLINE: "Recommends decline",
  ESCALATE: "Needs a specialist",
};

export const RECOMMENDATION_TONES: Record<Recommendation, BadgeTone> = {
  APPROVE: "positive",
  DECLINE: "neutral",
  ESCALATE: "attention",
};

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  POSITIVE: "Positive",
  NEUTRAL: "Calm",
  NEGATIVE: "Frustrated",
  DISTRESSED: "Distressed",
};

export const SENTIMENT_TONES: Record<Sentiment, BadgeTone> = {
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  NEGATIVE: "attention",
  DISTRESSED: "attention",
};

export const RISK_LABELS: Record<RiskLevel, string> = { LOW: "Low risk", MEDIUM: "Medium risk", HIGH: "High risk" };

export const RISK_TONES: Record<RiskLevel, BadgeTone> = { LOW: "neutral", MEDIUM: "attention", HIGH: "danger" };
