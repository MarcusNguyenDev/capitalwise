import type { AutonomyStat } from "@/shared/types/resources.type";
import { Button } from "@/shared/ui/button.component";

interface AutonomyHeadlineCardProps {
  autonomy_stat: AutonomyStat;
  has_open_proposal: boolean;
  is_proposing: boolean;
  onPropose: (action_code: AutonomyStat["action_code"]) => void;
}

/** The evidence that an action has earned more autonomy, and the button that starts a human sign-off. */
export function AutonomyHeadlineCard({ autonomy_stat, has_open_proposal, is_proposing, onPropose }: AutonomyHeadlineCardProps) {
  return (
    <div className="flex items-center justify-between gap-8 rounded-2xl border-2 border-accent bg-accent-soft px-8 py-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Earned autonomy</p>
        <p className="mt-1 text-2xl font-bold leading-snug">{autonomy_stat.headline}</p>
        <p className="mt-2 text-lg text-ink-soft">
          Proposing records a request for team-leader sign-off. It does not change live policy: these cases keep going to the approval queue.
        </p>
      </div>
      <Button
        variant="primary"
        size="large"
        className="shrink-0"
        disabled={has_open_proposal || is_proposing}
        onClick={() => onPropose(autonomy_stat.action_code)}
      >
        {has_open_proposal ? "Proposal awaiting sign-off" : is_proposing ? "Recording…" : "Propose promoting to Tier 1"}
      </Button>
    </div>
  );
}
