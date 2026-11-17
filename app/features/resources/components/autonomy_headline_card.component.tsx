import { Sparkles } from "lucide-react";

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
    <section aria-label="Earned autonomy candidate" className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-white px-5 py-4 shadow-card">
      <Sparkles className="size-6 shrink-0 text-info" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{autonomy_stat.headline}</p>
        <p className="mt-1 text-sm text-ink-soft">
          Proposing records a request for team-leader sign-off. It does not change live policy: these cases keep going to the approval queue.
        </p>
      </div>
      <Button variant="primary" is_loading={is_proposing} disabled={has_open_proposal} onClick={() => onPropose(autonomy_stat.action_code)}>
        {has_open_proposal ? "Proposal waiting for sign-off" : "Propose promoting to Tier 1"}
      </Button>
    </section>
  );
}
