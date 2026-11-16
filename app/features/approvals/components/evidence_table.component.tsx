import { formatFactValue } from "@/shared/format/format_values.util";
import type { EvidenceRow } from "@/shared/types/case.type";
import { Chip } from "@/shared/ui/chip.component";

export function EvidenceTable({ evidence }: { evidence: EvidenceRow[] }) {
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="text-sm uppercase tracking-wide text-ink-faint">
          <th className="py-1.5 font-semibold">Fact</th>
          <th className="py-1.5 font-semibold">Value</th>
          <th className="py-1.5 font-semibold">Source</th>
        </tr>
      </thead>
      <tbody>
        {evidence.map((evidence_row) => (
          <tr key={evidence_row.fact} className="border-t border-line align-top">
            <td className="py-2 pr-4 font-medium">
              {evidence_row.label} {evidence_row.is_required ? <Chip tone="info">Required</Chip> : null}
            </td>
            <td className="py-2 pr-4 font-mono text-[0.95rem] font-semibold">{formatFactValue(evidence_row.value)}</td>
            <td className="py-2 font-mono text-sm text-ink-soft">{evidence_row.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
