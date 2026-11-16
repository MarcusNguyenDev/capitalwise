"use client";

import { fetchRoutingOverview } from "@/shared/api_client/engine_api.client";
import { formatCodeLabel, formatDateTime } from "@/shared/format/format_values.util";
import { CASE_EVENTS, LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { RecentRoute, SkillQueue } from "@/shared/types/resources.type";
import { Chip, TierChip } from "@/shared/ui/chip.component";
import { Card, EmptyState, ErrorState, LoadingState, SectionHeading } from "@/shared/ui/surface.component";

const ROUTING_EVENTS = [...CASE_EVENTS, LIVE_EVENT.STAFF_UPDATED];

function SkillQueueCard({ skill_queue }: { skill_queue: SkillQueue }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h3 className="text-xl font-bold">{formatCodeLabel(skill_queue.skill)}</h3>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <QueueNumber label="waiting" value={String(skill_queue.waiting_case_count)} />
        <QueueNumber label="available" value={String(skill_queue.available_staff_count)} />
        <QueueNumber label="expected wait" value={`${skill_queue.expected_wait_minutes} min`} />
      </div>
    </section>
  );
}

function QueueNumber({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span key={value} className="block animate-highlight rounded text-3xl font-black tabular-nums">
        {value}
      </span>
      <span className="text-sm font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
    </p>
  );
}

function RecentRouteTable({ recent_routes }: { recent_routes: RecentRoute[] }) {
  if (recent_routes.length === 0) {
    return <EmptyState title="No cases have been routed yet" />;
  }
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="text-sm uppercase tracking-wide text-ink-faint">
          <th className="py-2 font-semibold">Case</th>
          <th className="py-2 font-semibold">Customer</th>
          <th className="py-2 font-semibold">Action</th>
          <th className="py-2 font-semibold">Skill needed</th>
          <th className="py-2 font-semibold">Routed to</th>
          <th className="py-2 font-semibold">Rule used</th>
          <th className="py-2 text-right font-semibold">When</th>
        </tr>
      </thead>
      <tbody>
        {recent_routes.map((recent_route) => (
          <tr key={recent_route.case_number} className="animate-slide-in border-t border-line align-top">
            <td className="py-2.5 pr-4 font-mono text-sm">{recent_route.case_number}</td>
            <td className="whitespace-nowrap py-2.5 pr-4 font-semibold">{recent_route.customer_name}</td>
            <td className="py-2.5 pr-4">
              <span className="flex flex-wrap items-center gap-2">
                {formatCodeLabel(recent_route.action_code)} <TierChip tier={recent_route.tier} />
              </span>
            </td>
            <td className="py-2.5 pr-4">{recent_route.required_skill ? <Chip tone="info">{formatCodeLabel(recent_route.required_skill)}</Chip> : "–"}</td>
            <td className="whitespace-nowrap py-2.5 pr-4 font-semibold">{recent_route.assigned_staff_name ?? "–"}</td>
            <td className="py-2.5 pr-4 text-ink-soft">{recent_route.routing_rule ?? "–"}</td>
            <td className="whitespace-nowrap py-2.5 text-right text-ink-soft">{formatDateTime(recent_route.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RoutingSection() {
  const routing_query = useLiveQuery(fetchRoutingOverview, ROUTING_EVENTS);
  const routing_overview = routing_query.data;

  if (!routing_overview) {
    return routing_query.error_message ? <ErrorState message={routing_query.error_message} /> : <LoadingState label="Loading routing" />;
  }
  return (
    <div className="space-y-8">
      <p className="rounded-2xl bg-surface px-6 py-4 text-xl">
        <span className="font-bold">Resolve, don&apos;t deflect.</span> Asking for a person gets a person with the right skill and the full context of the call.
      </p>
      <div>
        <SectionHeading title="Queues by skill" />
        <div className="grid grid-cols-4 gap-4">
          {routing_overview.queues.map((skill_queue) => (
            <SkillQueueCard key={skill_queue.skill} skill_queue={skill_queue} />
          ))}
        </div>
      </div>
      <Card>
        <SectionHeading title="How recent cases were routed" description="The rule that picked the specialist is stored on every case." />
        <RecentRouteTable recent_routes={routing_overview.recent_routes} />
      </Card>
    </div>
  );
}
