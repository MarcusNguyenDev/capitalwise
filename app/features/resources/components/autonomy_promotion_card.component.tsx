import { BadgeCheck } from "lucide-react";
import Link from "next/link";

import { formatCalendarDate } from "@/shared/format/format_values.util";
import type { AutonomyProposal, AutonomyStat } from "@/shared/types/resources.type";

/** An action that already earned its autonomy: who signed it off, and the policy that now runs it on the call. */
export function AutonomyPromotionCard({ autonomy_stat, promotion }: { autonomy_stat: AutonomyStat; promotion: AutonomyProposal }) {
  return (
    <section aria-label="Earned autonomy promotion" className="flex flex-wrap items-center gap-4 rounded-lg border border-positive/30 bg-positive-soft px-5 py-4">
      <BadgeCheck className="size-6 shrink-0 text-positive" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug text-positive">
          Promoted to Tier 1, signed off by {promotion.signed_off_by_name ?? promotion.signed_off_by ?? "the team leader"}
          {promotion.signed_off_at ? ` on ${formatCalendarDate(promotion.signed_off_at)}` : ""}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {promotion.title.replace(/^Promote to Tier 1:\s*/, "")}: {autonomy_stat.agreement_pct}% staff agreement over {autonomy_stat.decided_cases} decisions. Rule{" "}
          <span className="font-mono text-xs font-semibold text-ink">{promotion.matched_rule_id}</span> in <span className="font-mono text-xs font-semibold text-ink">{promotion.published_policy_id}</span> now runs these on the call;
          everything else still goes to a person.
        </p>
      </div>
      <Link href={`/resources/policies?action=${promotion.action_code}`} className="text-sm font-semibold text-info hover:underline">
        See the policy
      </Link>
    </section>
  );
}
