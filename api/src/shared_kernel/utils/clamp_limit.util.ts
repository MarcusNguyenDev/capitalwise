export interface LimitBounds {
  default_limit: number;
  max_limit: number;
}

export function clampLimit(
  requested_limit: number | undefined,
  bounds: LimitBounds,
): number {
  if (requested_limit === undefined || Number.isNaN(requested_limit)) {
    return bounds.default_limit;
  }
  return Math.min(Math.max(requested_limit, 1), bounds.max_limit);
}
