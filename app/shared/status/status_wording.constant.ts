import type { CallStatus, RiskLevel, Sentiment } from "@/shared/types/call.type";
import type { ActionCode, CaseStatus, ProposalOutcome, Recommendation } from "@/shared/types/case.type";
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
  1: "Policy decides on the call: done straight away, or declined with the reason.",
  2: "A person approves the AI's proposal before anything happens.",
  3: "Goes to a specialist. The AI never decides these.",
};

export const TIER_TONES: Record<number, BadgeTone> = { 1: "positive", 2: "info", 3: "attention" };

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  AUTO_EXECUTED: "Done automatically",
  AUTO_DECLINED: "Declined by policy",
  PENDING_APPROVAL: "Waiting for approval",
  ESCALATED: "With a specialist",
  APPROVED: "Approved",
  EDITED_AND_APPROVED: "Approved with changes",
  REJECTED: "Rejected",
  EXECUTED: "Completed",
};

export const CASE_STATUS_TONES: Record<CaseStatus, BadgeTone> = {
  AUTO_EXECUTED: "positive",
  AUTO_DECLINED: "neutral",
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

/** What the AI could tell the caller once policy decided its proposal. */
export const PROPOSAL_OUTCOME_LABELS: Record<ProposalOutcome, string> = {
  DONE: "Done on the call",
  DECLINED: "Declined by policy",
  WITH_SPECIALIST: "With a specialist",
  PENDING_REVIEW: "Waiting for approval",
};

export const PROPOSAL_OUTCOME_TONES: Record<ProposalOutcome, BadgeTone> = {
  DONE: "positive",
  DECLINED: "neutral",
  WITH_SPECIALIST: "attention",
  PENDING_REVIEW: "info",
};

/** Plain names for what the AI can ask the bank to do. */
export const ACTION_LABELS: Record<ActionCode, string> = {
  LOCK_CARD: "Lock card",
  REPORT_LOST_STOLEN: "Report card lost or stolen",
  UNLOCK_CARD: "Unlock card",
  REPLACE_CARD: "Order a replacement card",
  ACTIVATE_CARD: "Activate a new card",
  REFUND_FEE: "Refund a fee",
  RAISE_DISPUTE: "Dispute a transaction",
  REQUEST_STATEMENT: "Send a statement",
  UPDATE_PREFERENCES: "Update contact preferences",
  PAYMENT_ARRANGEMENT: "Payment arrangement",
  HARDSHIP_REQUEST: "Hardship request",
  RELEASE_HELD_PAYMENT: "Release a held payment",
  SERVICE_REQUEST: "Account change request",
  HUMAN_CALLBACK: "Specialist callback",
};

/** One plain sentence per action: what it does for the customer. */
export const ACTION_DESCRIPTIONS: Record<ActionCode, string> = {
  LOCK_CARD: "Temporarily stops a card being used. It can be unlocked later.",
  REPORT_LOST_STOLEN: "Blocks a lost or stolen card for good.",
  UNLOCK_CARD: "Removes a temporary lock so the card works again.",
  REPLACE_CARD: "Sends a new card to the address on file and blocks the old one.",
  ACTIVATE_CARD: "Switches on a new card that has arrived.",
  REFUND_FEE: "Gives back a fee the customer was charged.",
  RAISE_DISPUTE: "Lodges a dispute about a payment, with a provisional credit for clear duplicates.",
  REQUEST_STATEMENT: "Posts or emails a statement covering up to 12 months.",
  UPDATE_PREFERENCES: "Changes paper statements, SMS alerts or large-print letters.",
  PAYMENT_ARRANGEMENT: "Agrees smaller payments for a few weeks and pauses late fees.",
  HARDSHIP_REQUEST: "Records a financial hardship notice; a specialist decides within 21 days.",
  RELEASE_HELD_PAYMENT: "Releases a payment held for a scam check. Never automatic.",
  SERVICE_REQUEST: "A change staff complete, such as a new address, a higher limit or a new payee.",
  HUMAN_CALLBACK: "A specialist calls the customer back with the full context.",
};

/** Where the caller is in confirming who they are. One label per state, used on tiles, headers and summaries. */
export type CallIdentityState = "NOT_CONFIRMED" | "QUESTIONS_LEVEL_1" | "QUESTIONS_LEVEL_2" | "APP_LEVEL_1" | "LOCKED";

export const CALL_IDENTITY_LABELS: Record<CallIdentityState, string> = {
  NOT_CONFIRMED: "Identity not yet confirmed",
  QUESTIONS_LEVEL_1: "Confirmed by questions, level 1",
  QUESTIONS_LEVEL_2: "Confirmed by questions, level 2",
  APP_LEVEL_1: "Confirmed in app, level 1",
  LOCKED: "Locked after failed checks",
};

export const CALL_IDENTITY_TONES: Record<CallIdentityState, BadgeTone> = {
  NOT_CONFIRMED: "neutral",
  QUESTIONS_LEVEL_1: "positive",
  QUESTIONS_LEVEL_2: "positive",
  APP_LEVEL_1: "positive",
  LOCKED: "danger",
};

export const CALL_IDENTITY_DESCRIPTIONS: Record<CallIdentityState, string> = {
  NOT_CONFIRMED: "The AI asks only when the caller's request needs it.",
  QUESTIONS_LEVEL_1: "Full name, date of birth and postcode matched the bank's records.",
  QUESTIONS_LEVEL_2: "Name, date of birth and postcode, plus a question about the customer's own recent activity.",
  APP_LEVEL_1: "The customer approved a check in their banking app.",
  LOCKED: "Too many failed answers. The account is not discussed; a fraud specialist has a case.",
};

/** What an action asks of the caller's identity before the AI may propose it. */
export const IDENTITY_REQUIREMENT_LABELS: Record<number, string> = {
  0: "No identity check needed",
  1: "Identity confirmed to level 1",
  2: "Identity confirmed to level 2",
};

export const IDENTITY_REQUIREMENT_DESCRIPTIONS: Record<number, string> = {
  0: "Anyone on the call can ask for this.",
  1: "Full name, date of birth and postcode.",
  2: "Level 1 plus a question about the customer's own recent activity.",
};

/** Shown until identity is confirmed: the number alone never names the customer. */
export const UNIDENTIFIED_CALLER_NAME = "Unidentified caller";
