export type JourneySide = "LEGACY" | "AI";

export interface JourneySideStyle {
  outcome_label: string;
  outcome_mark: string;
  card_class_name: string;
  heading_class_name: string;
  total_class_name: string;
  outcome_class_name: string;
  step_number_class_name: string;
  segment_class_names: readonly [string, string];
}

/** The legacy side is deliberately grey so the accent colour belongs to the AI side alone. */
export const JOURNEY_SIDE_STYLES: Record<JourneySide, JourneySideStyle> = {
  LEGACY: {
    outcome_label: "Deflected",
    outcome_mark: "✕",
    card_class_name: "border-line bg-surface",
    heading_class_name: "text-ink-soft",
    total_class_name: "text-ink-soft",
    outcome_class_name: "bg-ink text-white",
    step_number_class_name: "bg-ink-faint text-white",
    segment_class_names: ["bg-ink-soft", "bg-ink-faint"],
  },
  AI: {
    outcome_label: "Resolved",
    outcome_mark: "✓",
    card_class_name: "border-2 border-accent bg-white",
    heading_class_name: "text-accent",
    total_class_name: "text-accent",
    outcome_class_name: "bg-accent text-white",
    step_number_class_name: "bg-accent text-white",
    segment_class_names: ["bg-accent", "bg-accent-dark"],
  },
};
