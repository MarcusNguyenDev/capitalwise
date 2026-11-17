export type JourneySide = "LEGACY" | "AI";

export interface JourneySideStyle {
  outcome_label: string;
  card_class_name: string;
  heading_class_name: string;
  outcome_class_name: string;
  step_number_class_name: string;
  segment_class_names: readonly [string, string];
}

/** The legacy side is deliberately grey so the brand colour belongs to the AI side alone. */
export const JOURNEY_SIDE_STYLES: Record<JourneySide, JourneySideStyle> = {
  LEGACY: {
    outcome_label: "Deflected",
    card_class_name: "border-line bg-canvas",
    heading_class_name: "text-ink-soft",
    outcome_class_name: "bg-surface text-ink",
    step_number_class_name: "bg-surface text-ink-soft",
    segment_class_names: ["bg-ink-soft", "bg-ink-faint"],
  },
  AI: {
    outcome_label: "Resolved",
    card_class_name: "border-line bg-white shadow-card",
    heading_class_name: "text-ink",
    outcome_class_name: "bg-positive-soft text-positive",
    step_number_class_name: "bg-accent text-white",
    segment_class_names: ["bg-accent", "bg-accent-dark"],
  },
};
