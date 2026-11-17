import { formatCodeLabel, formatLongDuration } from "@/shared/format/format_values.util";
import type { AutonomyStat } from "@/shared/types/resources.type";
import { Badge } from "@/shared/ui/badge.component";
import { DataTable } from "@/shared/ui/data_table.component";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

function AgreementBar({ autonomy_stat }: { autonomy_stat: AutonomyStat }) {
  return (
    <span className="flex min-w-36 items-center gap-2">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
        <span
          className={joinClassNames("block h-full rounded-full", autonomy_stat.is_eligible ? "bg-positive" : "bg-ink-faint")}
          style={{ width: `${Math.min(100, autonomy_stat.agreement_pct)}%` }}
        />
      </span>
      <span className="w-10 text-right font-medium tabular-nums">{autonomy_stat.agreement_pct}%</span>
    </span>
  );
}

/** How often staff decided the way the AI and policy recommended, per action. */
export function AutonomyStatsTable({ autonomy_stats }: { autonomy_stats: AutonomyStat[] }) {
  return (
    <DataTable<AutonomyStat>
      caption="Agreement by action"
      rows={autonomy_stats}
      readRowKey={(autonomy_stat) => autonomy_stat.action_code}
      columns={[
        {
          key: "action",
          header: "Action",
          renderCell: (autonomy_stat) => (
            <span className="flex flex-wrap items-center gap-2 font-medium">
              {formatCodeLabel(autonomy_stat.action_code)}
              {autonomy_stat.is_eligible ? <Badge tone="positive">Eligible</Badge> : null}
            </span>
          ),
        },
        { key: "agreement", header: "Staff agreed with the AI", renderCell: (autonomy_stat) => <AgreementBar autonomy_stat={autonomy_stat} /> },
        { key: "decisions", header: "Decisions", is_numeric: true, renderCell: (autonomy_stat) => autonomy_stat.decided_cases },
        { key: "edited", header: "Edited", is_numeric: true, renderCell: (autonomy_stat) => autonomy_stat.edited_count },
        {
          key: "time",
          header: "Time to decide",
          is_numeric: true,
          renderCell: (autonomy_stat) => formatLongDuration(autonomy_stat.avg_minutes_to_decision * 60),
        },
      ]}
    />
  );
}
