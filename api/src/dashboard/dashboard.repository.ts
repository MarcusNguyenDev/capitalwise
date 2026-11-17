import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly database: DatabaseService) {}

  // "Today" is the last 24 hours, so the numbers never empty out at midnight
  // in the middle of a demo.
  async selectKpis() {
    const kpi_rows = await this.database.query(
      `SELECT
         (SELECT COUNT(*)::int FROM engine.calls WHERE status <> 'ENDED') AS live_calls,
         (SELECT COUNT(*)::int FROM engine.calls WHERE status = 'AI_ACTIVE') AS handled_by_ai,
         (SELECT COUNT(*)::int FROM engine.calls WHERE status = 'NEEDS_ATTENTION') AS needing_attention,
         (SELECT COUNT(*)::int FROM engine.calls WHERE status = 'HUMAN_ACTIVE') AS with_humans,
         (SELECT round(AVG((metrics ->> 'avg_response_ms')::numeric))::int
            FROM engine.calls
           WHERE started_at > now() - interval '24 hours'
             AND metrics ->> 'avg_response_ms' ~ '^[0-9]+(\\.[0-9]+)?$') AS avg_ai_response_ms,
         (SELECT COUNT(*)::int FROM engine.cases
           WHERE status = 'AUTO_EXECUTED' AND created_at > now() - interval '24 hours') AS cases_auto_resolved_today,
         (SELECT COUNT(*)::int FROM engine.staff_users WHERE status = 'AVAILABLE') AS staff_available,
         (SELECT COUNT(*)::int FROM engine.calls WHERE started_at > now() - interval '24 hours') AS calls_today`,
    );
    return kpi_rows[0];
  }

  // ESCALATED cases, plus live calls needing attention that have no
  // escalated case of their own. Longest waiting first.
  selectEscalations() {
    return this.database.query(
      `SELECT 'CASE:' || each_case.case_number AS escalation_key, 'CASE' AS kind,
              each_case.case_number, each_case.call_id, each_case.customer_name, each_case.action_code,
              each_case.tier, each_case.route_reason AS reason,
              CASE
                WHEN jsonb_array_length(COALESCE(each_case.soft_signals -> 'scam_coaching_signals', '[]'::jsonb))
                   + jsonb_array_length(COALESCE(each_case.soft_signals -> 'vulnerability_signals', '[]'::jsonb))
                   + jsonb_array_length(COALESCE(each_case.soft_signals -> 'fraud_signals', '[]'::jsonb)) > 0
                  THEN 'HIGH'
                ELSE COALESCE(call.risk_level, 'MEDIUM')
              END AS risk_level,
              each_case.assigned_staff_id, staff.name AS assigned_staff_name,
              EXTRACT(EPOCH FROM (now() - each_case.created_at))::int AS waiting_seconds,
              each_case.created_at
       FROM engine.cases AS each_case
       LEFT JOIN engine.calls AS call ON call.call_id = each_case.call_id
       LEFT JOIN engine.staff_users AS staff ON staff.staff_id = each_case.assigned_staff_id
       WHERE each_case.status = 'ESCALATED'
       UNION ALL
       SELECT 'CALL:' || call.call_id, 'CALL', NULL, call.call_id, call.customer_name, NULL,
              NULL::int, call.attention_reason, call.risk_level,
              call.assigned_staff_id, staff.name,
              EXTRACT(EPOCH FROM (now() - attention.since))::int, attention.since
       FROM engine.calls AS call
       LEFT JOIN engine.staff_users AS staff ON staff.staff_id = call.assigned_staff_id
       CROSS JOIN LATERAL (
         SELECT COALESCE(MAX(event.occurred_at), call.started_at) AS since
         FROM engine.audit_events AS event
         WHERE event.call_id = call.call_id
           AND event.event_type = 'CALL_STATUS_CHANGED'
           AND event.detail ->> 'to' = 'NEEDS_ATTENTION'
       ) AS attention
       WHERE call.status = 'NEEDS_ATTENTION'
         AND NOT EXISTS (
           SELECT 1 FROM engine.cases AS escalated_case
           WHERE escalated_case.call_id = call.call_id AND escalated_case.status = 'ESCALATED'
         )
       ORDER BY waiting_seconds DESC`,
    );
  }
}
