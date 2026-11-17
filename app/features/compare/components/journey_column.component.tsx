import { CircleCheck, CircleX } from "lucide-react";

import { formatLongDuration } from "@/shared/format/format_values.util";
import type { Journey, JourneyStep } from "@/shared/types/resources.type";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

import { JOURNEY_SIDE_STYLES } from "../constants/journey_side.constant";
import type { JourneySide, JourneySideStyle } from "../constants/journey_side.constant";
import { formatStepDuration } from "../utils/format_step_duration.util";

function JourneyStepRow({ journey_step, step_number, side_style }: { journey_step: JourneyStep; step_number: number; side_style: JourneySideStyle }) {
  return (
    <li className={joinClassNames("grid grid-cols-[1.75rem_1fr_auto] items-start gap-3", journey_step.is_optional_path && "rounded-md border border-dashed border-line-strong px-2 py-1.5")}>
      <span className={joinClassNames("flex size-7 items-center justify-center rounded-full text-xs font-semibold", side_style.step_number_class_name)}>{step_number}</span>
      <div>
        <p className="font-medium leading-tight">{journey_step.label}</p>
        <p className="text-sm text-ink-soft">{journey_step.detail}</p>
      </div>
      <p className="text-right">
        <span className="block font-semibold tabular-nums">{formatStepDuration(journey_step.duration_seconds)}</span>
        {journey_step.is_measured ? <span className="block text-xs font-medium text-positive">measured</span> : null}
        {journey_step.is_optional_path ? <span className="block text-xs text-ink-faint">not in total</span> : null}
      </p>
    </li>
  );
}

// The configured outcome often starts with the same word as the label ("Deflected. Told to...").
function removeOutcomeLabel(outcome: string, outcome_label: string): string {
  const remaining_outcome = outcome.startsWith(outcome_label) ? outcome.slice(outcome_label.length).replace(/^[.,:]?\s*/, "") : outcome;
  return remaining_outcome.charAt(0).toUpperCase() + remaining_outcome.slice(1);
}

export function JourneyColumn({ journey, side }: { journey: Journey; side: JourneySide }) {
  const side_style = JOURNEY_SIDE_STYLES[side];
  const OutcomeIcon = side === "AI" ? CircleCheck : CircleX;
  return (
    <section aria-label={journey.title} className={joinClassNames("flex flex-col rounded-lg border px-5 py-4", side_style.card_class_name)}>
      <div className="flex items-start justify-between gap-4">
        <h2 className={joinClassNames("text-base font-semibold", side_style.heading_class_name)}>{journey.title}</h2>
        <p className="shrink-0 text-right">
          <span className="block text-xl font-semibold tabular-nums">{formatLongDuration(journey.total_seconds)}</span>
          <span className="text-xs text-ink-faint">total time</span>
        </p>
      </div>
      <ol className="mt-3 flex flex-1 flex-col gap-3">
        {journey.steps.map((journey_step, step_index) => (
          <JourneyStepRow key={journey_step.label} journey_step={journey_step} step_number={step_index + 1} side_style={side_style} />
        ))}
      </ol>
      <div className={joinClassNames("mt-4 flex gap-2 rounded-md px-3 py-2 text-sm", side_style.outcome_class_name)}>
        <OutcomeIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <span className="font-semibold">{side_style.outcome_label}.</span> {removeOutcomeLabel(journey.outcome, side_style.outcome_label)}
        </p>
      </div>
    </section>
  );
}
