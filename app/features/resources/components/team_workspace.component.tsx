"use client";

import { fetchRoutingOverview, fetchWorkforce } from "@/shared/api_client/engine_api.client";
import { CALL_EVENTS, CASE_EVENTS, LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { Workforce } from "@/shared/types/resources.type";
import { Card } from "@/shared/ui/card.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { PageHeader } from "@/shared/ui/page_header.component";
import { SkeletonDetail } from "@/shared/ui/skeleton.component";

import { AiAgentTable } from "./ai_agent_table.component";
import { RecentRoutesTable } from "./recent_routes_table.component";
import { SkillQueueSummary } from "./skill_queue_summary.component";
import { StaffTable } from "./staff_table.component";

const WORKFORCE_EVENTS = [LIVE_EVENT.STAFF_UPDATED, ...CALL_EVENTS, ...CASE_EVENTS];
const ROUTING_EVENTS = [...CASE_EVENTS, LIVE_EVENT.STAFF_UPDATED];

function describeLeverage(workforce: Workforce): string {
  const available_staff_count = workforce.staff.filter((staff_member) => staff_member.status === "AVAILABLE").length;
  const live_call_count = workforce.ai_agents.reduce((call_count, ai_agent) => call_count + ai_agent.active_call_count, 0);
  const call_capacity = workforce.ai_agents.reduce((capacity, ai_agent) => capacity + ai_agent.max_concurrent_calls, 0);
  return `${available_staff_count} of ${workforce.staff.length} specialists available, overseeing ${live_call_count} live AI calls (capacity ${call_capacity}).`;
}

/** Team and routing: who can take escalations now, the queues by skill, the AI pool, and how cases were routed. */
export function TeamWorkspace() {
  const workforce_query = useLiveQuery(fetchWorkforce, WORKFORCE_EVENTS);
  const routing_query = useLiveQuery(fetchRoutingOverview, ROUTING_EVENTS);
  const workforce = workforce_query.data;
  const routing_overview = routing_query.data;

  return (
    <>
      <PageHeader title="Team and routing" description={workforce ? describeLeverage(workforce) : "Who is available, the queues by skill, and the AI agents."} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-6">
        {routing_overview ? (
          <section aria-label="Queues by skill">
            <h2 className="mb-2 text-sm font-semibold">Queues by skill</h2>
            <SkillQueueSummary skill_queues={routing_overview.queues} />
          </section>
        ) : null}
        {workforce_query.error_message ? <ErrorState message={workforce_query.error_message} onRetry={workforce_query.reload} /> : null}
        {workforce ? (
          <>
            <Card title="Specialists" description="Change a status to change who new escalations are routed to.">
              <StaffTable staff_members={workforce.staff} />
            </Card>
            <Card title="AI agents" description="Live calls on each agent against its maximum.">
              <AiAgentTable ai_agents={workforce.ai_agents} />
            </Card>
          </>
        ) : workforce_query.error_message ? null : (
          <SkeletonDetail label="Loading the team" />
        )}
        {routing_query.error_message ? <ErrorState message={routing_query.error_message} onRetry={routing_query.reload} /> : null}
        {routing_overview ? (
          <Card title="How recent cases were routed" description="The rule that picked the specialist is stored on every case.">
            <RecentRoutesTable recent_routes={routing_overview.recent_routes} />
          </Card>
        ) : null}
      </div>
    </>
  );
}
