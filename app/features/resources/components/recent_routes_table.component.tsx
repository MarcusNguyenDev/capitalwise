import { formatCodeLabel, formatDateTime } from "@/shared/format/format_values.util";
import { TierBadge } from "@/shared/status/tier_badge.component";
import type { RecentRoute } from "@/shared/types/resources.type";
import { DataTable } from "@/shared/ui/data_table.component";
import { EmptyState } from "@/shared/ui/empty_state.component";

/** Which specialist each recent case went to, and the routing rule that chose them. */
export function RecentRoutesTable({ recent_routes }: { recent_routes: RecentRoute[] }) {
  if (recent_routes.length === 0) {
    return <EmptyState title="No cases have been routed yet" />;
  }
  return (
    <DataTable<RecentRoute>
      caption="Recently routed cases"
      rows={recent_routes}
      readRowKey={(recent_route) => recent_route.case_number}
      columns={[
        {
          key: "customer",
          header: "Customer",
          renderCell: (recent_route) => (
            <>
              <span className="block font-medium">{recent_route.customer_name}</span>
              <span className="block font-mono text-xs text-ink-faint">{recent_route.case_number}</span>
            </>
          ),
        },
        {
          key: "action",
          header: "Action",
          renderCell: (recent_route) => (
            <span className="flex flex-wrap items-center gap-1.5">
              {formatCodeLabel(recent_route.action_code)} <TierBadge tier={recent_route.tier} />
            </span>
          ),
        },
        { key: "skill", header: "Skill needed", renderCell: (recent_route) => formatCodeLabel(recent_route.required_skill) },
        { key: "routed_to", header: "Routed to", class_name: "font-medium whitespace-nowrap", renderCell: (recent_route) => recent_route.assigned_staff_name ?? "–" },
        { key: "rule", header: "Rule used", class_name: "text-ink-soft", renderCell: (recent_route) => recent_route.routing_rule ?? "–" },
        { key: "when", header: "When", is_numeric: true, class_name: "whitespace-nowrap text-ink-soft", renderCell: (recent_route) => formatDateTime(recent_route.created_at) },
      ]}
    />
  );
}
