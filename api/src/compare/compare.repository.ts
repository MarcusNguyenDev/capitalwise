import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { MeasuredCallMetrics } from './types/compare_journey.type';

const NUMERIC_TEXT_PATTERN = '^[0-9]+(\\.[0-9]+)?$';

function averageMetricSql(metric_key: string): string {
  return `AVG(CASE WHEN metrics ->> '${metric_key}' ~ '${NUMERIC_TEXT_PATTERN}' THEN (metrics ->> '${metric_key}')::numeric END)`;
}

@Injectable()
export class CompareRepository {
  constructor(private readonly database: DatabaseService) {}

  // Averages over ended calls, read from the metrics the core service stores.
  async selectMeasuredMetrics(): Promise<MeasuredCallMetrics> {
    const metric_rows = await this.database.query<MeasuredCallMetrics>(
      `SELECT COUNT(*)::int AS sample_call_count,
              round(${averageMetricSql('avg_response_ms')})::int AS avg_response_ms,
              round(${averageMetricSql('time_to_identity_ms')})::int AS avg_time_to_identity_ms,
              round(${averageMetricSql('time_to_resolution_ms')})::int AS avg_time_to_resolution_ms,
              round(${averageMetricSql('time_to_human_ms')})::int AS avg_time_to_human_ms,
              round(${averageMetricSql('estimated_cost_usd')}, 2) AS avg_cost_usd
       FROM engine.calls
       WHERE status = 'ENDED' AND metrics <> '{}'::jsonb`,
    );
    return metric_rows[0];
  }
}
