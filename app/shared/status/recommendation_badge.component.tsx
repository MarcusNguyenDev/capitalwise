import { formatConfidence } from "@/shared/policy/describe_policy.util";
import type { Recommendation } from "@/shared/types/case.type";
import { Badge } from "@/shared/ui/badge.component";

import { RECOMMENDATION_LABELS, RECOMMENDATION_TONES } from "./status_wording.constant";

export function RecommendationBadge({ recommendation, confidence }: { recommendation: Recommendation; confidence?: number }) {
  return (
    <Badge tone={RECOMMENDATION_TONES[recommendation] ?? "neutral"}>
      {RECOMMENDATION_LABELS[recommendation] ?? recommendation}
      {confidence === undefined ? null : <span className="font-normal opacity-80">{formatConfidence(confidence)}</span>}
    </Badge>
  );
}
