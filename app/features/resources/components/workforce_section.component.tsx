"use client";

import { fetchWorkforce } from "@/shared/api_client/engine_api.client";
import { CALL_EVENTS, CASE_EVENTS, LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { Workforce } from "@/shared/types/resources.type";
import { ErrorState, LoadingState, SectionHeading } from "@/shared/ui/surface.component";

import { AiAgentCard } from "./ai_agent_card.component";
import { StaffCard } from "./staff_card.component";

const WORKFORCE_EVENTS = [LIVE_EVENT.STAFF_UPDATED, ...CALL_EVENTS, ...CASE_EVENTS];

function describeLeverage(workforce: Workforce): string {
  const available_staff_count = workforce.staff.filter((staff_member) => staff_member.status === "AVAILABLE").length;
  const live_call_count = workforce.ai_agents.reduce((call_count, ai_agent) => call_count + ai_agent.active_call_count, 0);
  const call_capacity = workforce.ai_agents.reduce((capacity, ai_agent) => capacity + ai_agent.max_concurrent_calls, 0);
  return `${available_staff_count} of ${workforce.staff.length} specialists available, overseeing ${live_call_count} live AI conversations (capacity ${call_capacity}).`;
}

export function WorkforceSection() {
  const workforce_query = useLiveQuery(fetchWorkforce, WORKFORCE_EVENTS);
  const workforce = workforce_query.data;

  if (!workforce) {
    return workforce_query.error_message ? <ErrorState message={workforce_query.error_message} /> : <LoadingState label="Loading the workforce" />;
  }
  return (
    <div className="space-y-8">
      <p className="rounded-2xl bg-surface px-6 py-4 text-xl">
        <span className="font-bold">Staff are redeployed, not replaced.</span> {describeLeverage(workforce)}
      </p>
      <div>
        <SectionHeading title="Human specialists" description="Set a status to change who new escalations are routed to." />
        <div className="grid grid-cols-5 gap-4">
          {workforce.staff.map((staff_member) => (
            <StaffCard key={staff_member.staff_id} staff_member={staff_member} onStatusChanged={workforce_query.reload} />
          ))}
        </div>
      </div>
      <div>
        <SectionHeading title="AI agent pool" description="Utilisation against each agent's maximum concurrent calls." />
        <div className="grid grid-cols-4 gap-4">
          {workforce.ai_agents.map((ai_agent) => (
            <AiAgentCard key={ai_agent.agent_id} ai_agent={ai_agent} />
          ))}
        </div>
      </div>
    </div>
  );
}
