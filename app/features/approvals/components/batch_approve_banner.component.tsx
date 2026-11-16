import { formatCurrency } from "@/shared/format/format_values.util";
import type { BatchGroup } from "@/shared/types/case.type";
import { Button } from "@/shared/ui/button.component";

export function BatchApproveBanner({ batch_group, onReview }: { batch_group: BatchGroup; onReview: (batch_group: BatchGroup) => void }) {
  return (
    <div className="flex animate-slide-in items-center justify-between gap-6 rounded-2xl border border-accent bg-accent-soft px-6 py-5">
      <div className="flex items-center gap-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-black text-white">
          {batch_group.case_count}
        </span>
        <div>
          <p className="text-2xl font-bold">{batch_group.label}</p>
          <p className="text-lg text-ink-soft">
            Same action, same recommendation, same policy rule <span className="font-mono font-semibold text-ink">{batch_group.matched_rule_id}</span>
            {batch_group.total_amount ? ` · ${formatCurrency(batch_group.total_amount)} in total` : ""} · {batch_group.route_reason}
          </p>
        </div>
      </div>
      <Button variant="primary" size="large" className="shrink-0" onClick={() => onReview(batch_group)}>
        Review and approve all {batch_group.case_count}
      </Button>
    </div>
  );
}
