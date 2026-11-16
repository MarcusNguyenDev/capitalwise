"use client";

import { useState } from "react";

import { PageHeading } from "@/shared/ui/surface.component";
import { TabBar } from "@/shared/ui/tab_bar.component";

import { AUDIT_TABS } from "../constants/audit_view.constant";
import type { AuditTabKey } from "../constants/audit_view.constant";

import { AuditLog } from "./audit_log.component";
import { CallReplay } from "./call_replay.component";
import { DecisionExplainer } from "./decision_explainer.component";

export function AuditWorkspace() {
  const [selected_tab, setSelectedTab] = useState<AuditTabKey>("AUDIT_LOG");
  return (
    <>
      <PageHeading
        title="Audit and explainability"
        description="For every decision you can see what the AI knew, which policy rule decided it, which model, prompt and policy version were used, and which human approved it."
      />
      <TabBar tabs={AUDIT_TABS} selected_key={selected_tab} onSelect={setSelectedTab} />
      {selected_tab === "AUDIT_LOG" ? <AuditLog /> : null}
      {selected_tab === "DECISION_EXPLAINER" ? <DecisionExplainer /> : null}
      {selected_tab === "CALL_REPLAY" ? <CallReplay /> : null}
    </>
  );
}
