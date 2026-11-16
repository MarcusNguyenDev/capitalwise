import type { ReactNode } from "react";

import { formatCodeLabel } from "@/shared/format/format_values.util";
import type { CallStatus, RiskLevel, Sentiment } from "@/shared/types/call.type";

export type ChipTone = "neutral" | "accent" | "positive" | "warning" | "info" | "dark";

const TONE_CLASS_NAMES: Record<ChipTone, string> = {
  neutral: "bg-surface text-ink-soft",
  accent: "bg-accent-soft text-accent",
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  dark: "bg-ink text-white",
};

export function Chip({ tone = "neutral", children, className = "" }: { tone?: ChipTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold ${TONE_CLASS_NAMES[tone]} ${className}`}>
      {children}
    </span>
  );
}

const SENTIMENT_TONES: Record<Sentiment, ChipTone> = {
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  NEGATIVE: "warning",
  DISTRESSED: "accent",
};

const RISK_TONES: Record<RiskLevel, ChipTone> = { LOW: "positive", MEDIUM: "warning", HIGH: "accent" };

const TIER_LABELS: Record<number, string> = { 1: "Tier 1 · Auto", 2: "Tier 2 · Approve", 3: "Tier 3 · Escalate" };
const TIER_TONES: Record<number, ChipTone> = { 1: "positive", 2: "info", 3: "accent" };

const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  AI_ACTIVE: "AI handling",
  NEEDS_ATTENTION: "Needs attention",
  HUMAN_ACTIVE: "Human on call",
  ENDED: "Ended",
};

const CALL_STATUS_TONES: Record<CallStatus, ChipTone> = {
  AI_ACTIVE: "positive",
  NEEDS_ATTENTION: "accent",
  HUMAN_ACTIVE: "info",
  ENDED: "neutral",
};

export function SentimentChip({ sentiment }: { sentiment: Sentiment }) {
  return <Chip tone={SENTIMENT_TONES[sentiment]}>{formatCodeLabel(sentiment)}</Chip>;
}

export function RiskChip({ risk_level }: { risk_level: RiskLevel }) {
  return <Chip tone={RISK_TONES[risk_level]}>{formatCodeLabel(risk_level)} risk</Chip>;
}

export function TierChip({ tier }: { tier: number }) {
  return <Chip tone={TIER_TONES[tier] ?? "neutral"}>{TIER_LABELS[tier] ?? `Tier ${tier}`}</Chip>;
}

export function CallStatusChip({ status }: { status: CallStatus }) {
  return <Chip tone={CALL_STATUS_TONES[status]}>{CALL_STATUS_LABELS[status]}</Chip>;
}

export function CareFlagChip() {
  return <Chip tone="warning">Care flag</Chip>;
}
