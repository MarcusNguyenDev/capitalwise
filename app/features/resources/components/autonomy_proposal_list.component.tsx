import { Sparkles } from "lucide-react";

import { formatDateTime } from "@/shared/format/format_values.util";
import { formatActionLabel } from "@/shared/status/format_action_label.util";
import type { AutonomyProposal } from "@/shared/types/resources.type";
import { Badge } from "@/shared/ui/badge.component";
import { Button } from "@/shared/ui/button.component";
import { EmptyState } from "@/shared/ui/empty_state.component";

import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_TONES } from "../constants/resources_view.constant";

interface AutonomyProposalListProps {
  proposals: AutonomyProposal[];
  can_sign_off: boolean;
  signing_off_proposal_id: number | null;
  onSignOff: (proposal_id: number) => void;
}

function SignOffOutcome({ proposal }: { proposal: AutonomyProposal }) {
  const signer_name = proposal.signed_off_by_name ?? proposal.signed_off_by ?? "the team leader";
  if (proposal.published_policy_id) {
    return (
      <p className="text-sm text-ink-soft">
        Signed off by {signer_name} {formatDateTime(proposal.signed_off_at)} and published as{" "}
        <span className="font-mono text-xs font-semibold text-ink">{proposal.published_policy_id}</span>: these cases now run automatically on the call.
      </p>
    );
  }
  return (
    <p className="text-sm text-ink-soft">
      Signed off by {signer_name} {formatDateTime(proposal.signed_off_at)}. A policy owner must still publish a new policy version before anything changes.
    </p>
  );
}

export function AutonomyProposalList({ proposals, can_sign_off, signing_off_proposal_id, onSignOff }: AutonomyProposalListProps) {
  if (proposals.length === 0) {
    return <EmptyState icon={<Sparkles aria-hidden />} title="No proposals yet" description="Proposals appear here with their sign-off status." />;
  }
  return (
    <ul className="flex flex-col">
      {proposals.map((proposal) => (
        <li key={proposal.proposal_id} className="flex animate-fade-in flex-wrap items-center gap-4 border-b border-line py-3 last:border-b-0">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{proposal.title}</p>
            <p className="text-sm text-ink-soft">
              {formatActionLabel(proposal.action_code)}
              {proposal.matched_rule_id ? ` · rule ${proposal.matched_rule_id}` : ""} · {proposal.agreement_pct}% agreement over {proposal.decided_cases} decisions ·
              proposed by {proposal.proposed_by_name ?? proposal.proposed_by} · {formatDateTime(proposal.created_at)}
            </p>
            {proposal.status === "SIGNED_OFF" ? <SignOffOutcome proposal={proposal} /> : null}
          </div>
          <Badge tone={PROPOSAL_STATUS_TONES[proposal.status] ?? "neutral"}>{PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status}</Badge>
          {proposal.status === "PENDING_SIGN_OFF" ? (
            <Button
              variant="primary"
              disabled={!can_sign_off}
              is_loading={signing_off_proposal_id === proposal.proposal_id}
              title={can_sign_off ? undefined : "Only the team leader can sign off"}
              onClick={() => onSignOff(proposal.proposal_id)}
            >
              Sign off
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
