import { CallMetrics } from '../types/call_metrics.type';

export function appendResponseTime(
  metrics: CallMetrics,
  response_time_ms: number,
): CallMetrics {
  const response_times_ms = [
    ...(metrics.response_times_ms ?? []),
    Math.round(response_time_ms),
  ];
  const total_response_ms = response_times_ms.reduce(
    (running_total, each_time_ms) => running_total + each_time_ms,
    0,
  );
  return {
    ...metrics,
    response_times_ms,
    avg_response_ms: Math.round(total_response_ms / response_times_ms.length),
  };
}
