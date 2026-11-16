import type { Recommendation } from "@/shared/types/case.type";
import { Chip } from "@/shared/ui/chip.component";

import { formatConfidence } from "./describe_policy.util";
import { RECOMMENDATION_TONES } from "./policy_wording.constant";

const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  APPROVE: "Recommend approve",
  DECLINE: "Recommend decline",
  ESCALATE: "Needs a specialist",
};

export function RecommendationChip({ recommendation, confidence }: { recommendation: Recommendation; confidence?: number }) {
  return (
    <Chip tone={RECOMMENDATION_TONES[recommendation] ?? "neutral"}>
      {RECOMMENDATION_LABELS[recommendation] ?? recommendation}
      {confidence === undefined ? null : ` · ${formatConfidence(confidence)}`}
    </Chip>
  );
}
