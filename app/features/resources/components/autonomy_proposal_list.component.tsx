import { formatCodeLabel, formatDateTime } from "@/shared/format/format_values.util";
import type { AutonomyProposal } from "@/shared/types/resources.type";
import { Button } from "@/shared/ui/button.component";
import { Chip } from "@/shared/ui/chip.component";
import { EmptyState } from "@/shared/ui/surface.component";

import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_TONES } from "../constants/resources_view.constant";

interface AutonomyProposalListProps {
  proposals: AutonomyProposal[];
  can_sign_off: boolean;
  onSignOff: (proposal_id: number) => void;
}

export function AutonomyProposalList({ proposals, can_sign_off, onSignOff }: AutonomyProposalListProps) {
  if (proposals.length === 0) {
    return <EmptyState title="No proposals yet" description="Proposals appear here with their sign-off status." />;
  }
  return (
    <ul className="space-y-3">
      {proposals.map((proposal) => (
        <li key={proposal.proposal_id} className="flex animate-slide-in items-center justify-between gap-6 rounded-xl border border-line px-5 py-4">
          <div>
            <p className="text-lg font-bold">{proposal.title}</p>
            <p className="text-ink-soft">
              {formatCodeLabel(proposal.action_code)}
              {proposal.matched_rule_id ? ` · rule ${proposal.matched_rule_id}` : ""} · {proposal.agreement_pct}% agreement over {proposal.decided_cases}{" "}
              decisions · proposed by {proposal.proposed_by_name ?? proposal.proposed_by} · {formatDateTime(proposal.created_at)}
            </p>
            {proposal.status === "SIGNED_OFF" ? (
              <p className="text-ink-soft">
                Signed off {formatDateTime(proposal.signed_off_at)}. A policy owner must still publish a new policy version before anything changes.
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Chip tone={PROPOSAL_STATUS_TONES[proposal.status] ?? "neutral"}>{PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status}</Chip>
            {proposal.status === "PENDING_SIGN_OFF" ? (
              <Button
                variant="primary"
                disabled={!can_sign_off}
                title={can_sign_off ? undefined : "Only the team leader can sign off"}
                onClick={() => onSignOff(proposal.proposal_id)}
              >
                Sign off
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
