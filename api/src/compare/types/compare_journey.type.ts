export type MeasuredMetric =
  | 'avg_response_ms'
  | 'time_to_identity_ms'
  | 'time_to_resolution_ms'
  | 'time_to_human_ms';

// A step as written in config/compare_journey.json.
export interface JourneyStepConfig {
  label: string;
  detail: string;
  duration_seconds: number;
  // When real calls have produced this metric, its average replaces
  // duration_seconds.
  measured_metric?: MeasuredMetric;
  // Subtracted from measured_metric, for metrics that are counted from the
  // start of the call and so overlap an earlier step.
  subtract_metric?: MeasuredMetric;
  // An alternative ending (for example a human handover): shown, but left out
  // of the journey total.
  is_optional_path?: boolean;
}

export interface JourneyConfig {
  title: string;
  outcome: string;
  steps: JourneyStepConfig[];
}

export interface CompareJourneyConfig {
  legacy_journey: JourneyConfig;
  ai_journey: JourneyConfig;
}

export interface MeasuredCallMetrics {
  sample_call_count: number;
  avg_response_ms: number | null;
  avg_time_to_identity_ms: number | null;
  avg_time_to_resolution_ms: number | null;
  avg_time_to_human_ms: number | null;
  avg_cost_usd: number | null;
}
