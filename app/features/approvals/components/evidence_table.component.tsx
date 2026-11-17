import { formatFactValue } from "@/shared/format/format_values.util";
import type { EvidenceRow } from "@/shared/types/case.type";
import { DataTable } from "@/shared/ui/data_table.component";

/** Every fact the policy used, its value and the bank record it came from. */
export function EvidenceTable({ evidence, caption = "Evidence" }: { evidence: EvidenceRow[]; caption?: string }) {
  return (
    <DataTable<EvidenceRow>
      caption={caption}
      rows={evidence}
      readRowKey={(evidence_row) => evidence_row.fact}
      columns={[
        {
          key: "fact",
          header: "Fact",
          renderCell: (evidence_row) => (
            <>
              {evidence_row.label}
              {evidence_row.is_required ? <span className="ml-1.5 text-xs text-ink-faint">required</span> : null}
            </>
          ),
        },
        { key: "value", header: "Value", class_name: "font-medium", renderCell: (evidence_row) => formatFactValue(evidence_row.value) },
        { key: "source", header: "Source", class_name: "font-mono text-xs text-ink-faint", renderCell: (evidence_row) => evidence_row.source },
      ]}
    />
  );
}
