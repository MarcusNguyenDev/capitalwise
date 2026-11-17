import { ListChecks } from "lucide-react";

import { formatCurrency } from "@/shared/format/format_values.util";
import type { BatchGroup } from "@/shared/types/case.type";
import { Button } from "@/shared/ui/button.component";

/** Cases with the same action, recommendation and rule can be approved together after a review. */
export function BatchGroupCallout({ batch_group, onReview }: { batch_group: BatchGroup; onReview: (batch_group: BatchGroup) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-line bg-info-soft/50 px-4 py-3">
      <ListChecks className="size-5 shrink-0 text-info" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{batch_group.label}</p>
        <p className="truncate text-xs text-ink-soft">
          Same rule <span className="font-mono">{batch_group.matched_rule_id}</span>
          {batch_group.total_amount ? ` · ${formatCurrency(batch_group.total_amount)} in total` : ""}
        </p>
      </div>
      <Button size="small" onClick={() => onReview(batch_group)}>
        Review
      </Button>
    </div>
  );
}
