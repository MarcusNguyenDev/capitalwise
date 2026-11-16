"use client";

import { useState } from "react";

import { CallDetailPanel } from "@/features/call_detail/components/call_detail_panel.component";

import { useLiveCalls } from "../hooks/use_live_calls.hook";
import { EscalationsRail } from "./escalations_rail.component";
import { KpiStrip } from "./kpi_strip.component";
import { LiveCallsGrid } from "./live_calls_grid.component";
import { SimulatorControls } from "./simulator_controls.component";

// Wide screens (the 1920 recording) show grid, open call and escalations side by side;
// narrower ones move the escalations under the other two.
const LAYOUT_WITH_DETAIL = "xl:max-[1699px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] min-[1700px]:grid-cols-[minmax(0,1fr)_56rem_18rem]";
const LAYOUT_WITHOUT_DETAIL = "xl:grid-cols-[minmax(0,1fr)_22rem]";

/** The hero screen: KPIs, every live conversation, the open call and the escalations, all at once. */
export function SupervisorDashboard() {
  const [selected_call_id, setSelectedCallId] = useState<string | null>(null);
  const live_calls = useLiveCalls();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-4">
          <h1 className="text-3xl font-bold tracking-tight">Live conversations</h1>
          <p className="text-lg text-ink-soft">One specialist supervises many AI-handled calls and steps in only where a person is needed.</p>
        </div>
        <SimulatorControls />
      </div>
      <KpiStrip />
      <div className={`grid grid-cols-1 items-start gap-5 ${selected_call_id ? LAYOUT_WITH_DETAIL : LAYOUT_WITHOUT_DETAIL}`}>
        <LiveCallsGrid {...live_calls} selected_call_id={selected_call_id} onSelect={setSelectedCallId} />
        {selected_call_id ? <CallDetailPanel key={selected_call_id} call_id={selected_call_id} onClose={() => setSelectedCallId(null)} /> : null}
        <div className={selected_call_id ? "xl:max-[1699px]:col-span-2" : ""}>
          <EscalationsRail selected_call_id={selected_call_id} onOpenCall={setSelectedCallId} />
        </div>
      </div>
    </div>
  );
}
