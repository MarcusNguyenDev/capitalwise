import { formatLongDuration } from "@/shared/format/format_values.util";
import type { Journey, JourneyStep } from "@/shared/types/resources.type";

import { formatStepDuration } from "../utils/format_step_duration.util";
import { JOURNEY_SIDE_STYLES } from "../constants/journey_side.constant";
import type { JourneySide, JourneySideStyle } from "../constants/journey_side.constant";

function JourneyStepRow({ journey_step, step_number, side_style }: { journey_step: JourneyStep; step_number: number; side_style: JourneySideStyle }) {
  return (
    <li
      className={`grid animate-slide-in grid-cols-[2.75rem_1fr_auto] items-start gap-4 ${journey_step.is_optional_path ? "rounded-2xl border border-dashed border-line px-3 py-2" : ""}`}
      style={{ animationDelay: `${step_number * 90}ms` }}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-bold ${side_style.step_number_class_name}`}>
        {step_number}
      </span>
      <div>
        <p className="text-lg font-bold leading-tight">{journey_step.label}</p>
        <p className="leading-snug text-ink-soft">{journey_step.detail}</p>
      </div>
      <p className="text-right">
        <span className="block text-xl font-bold tabular-nums">{formatStepDuration(journey_step.duration_seconds)}</span>
        {journey_step.is_measured ? <span className="block text-sm font-semibold uppercase tracking-wide text-positive">measured</span> : null}
        {journey_step.is_optional_path ? <span className="block text-sm font-semibold uppercase tracking-wide text-ink-faint">not in total</span> : null}
      </p>
    </li>
  );
}

// The configured outcome often starts with the same word as the badge ("Deflected. Told to...").
function removeOutcomeLabel(outcome: string, outcome_label: string): string {
  const remaining_outcome = outcome.startsWith(outcome_label) ? outcome.slice(outcome_label.length).replace(/^[.,:]?\s*/, "") : outcome;
  return remaining_outcome.charAt(0).toUpperCase() + remaining_outcome.slice(1);
}

export function JourneyColumn({ journey, side }: { journey: Journey; side: JourneySide }) {
  const side_style = JOURNEY_SIDE_STYLES[side];
  return (
    <section className={`flex flex-col rounded-3xl border px-7 py-5 ${side_style.card_class_name}`}>
      <div className="flex items-start justify-between gap-6">
        <h2 className={`text-2xl font-black ${side_style.heading_class_name}`}>{journey.title}</h2>
        <p className="shrink-0 text-right">
          <span className={`block text-4xl font-black tabular-nums ${side_style.total_class_name}`}>{formatLongDuration(journey.total_seconds)}</span>
          <span className="text-sm font-semibold uppercase tracking-wide text-ink-faint">total time</span>
        </p>
      </div>
      <ol className="mt-3 flex-1 space-y-2.5">
        {journey.steps.map((journey_step, step_index) => (
          <JourneyStepRow key={journey_step.label} journey_step={journey_step} step_number={step_index + 1} side_style={side_style} />
        ))}
      </ol>
      <div className={`mt-4 rounded-2xl px-5 py-3 ${side_style.outcome_class_name}`}>
        <p className="text-xl font-black">
          {side_style.outcome_mark} {side_style.outcome_label}
        </p>
        <p>{removeOutcomeLabel(journey.outcome, side_style.outcome_label)}</p>
      </div>
    </section>
  );
}
