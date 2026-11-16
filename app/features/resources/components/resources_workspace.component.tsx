"use client";

import { useState } from "react";

import { PageHeading } from "@/shared/ui/surface.component";
import { TabBar } from "@/shared/ui/tab_bar.component";

import { RESOURCE_TABS } from "../constants/resources_view.constant";
import type { ResourceTabKey } from "../constants/resources_view.constant";

import { ActionRegistrySection } from "./action_registry_section.component";
import { EarnedAutonomySection } from "./earned_autonomy_section.component";
import { PromptVersionsSection } from "./prompt_versions_section.component";
import { RoutingSection } from "./routing_section.component";
import { WorkforceSection } from "./workforce_section.component";

export function ResourcesWorkspace() {
  const [selected_tab, setSelectedTab] = useState<ResourceTabKey>("WORKFORCE");
  return (
    <>
      <PageHeading
        title="Resource management"
        description="People, AI agents, routing rules, policies and prompts in one place. One specialist supervises many conversations and handles only what needs a person."
      />
      <TabBar tabs={RESOURCE_TABS} selected_key={selected_tab} onSelect={setSelectedTab} />
      {selected_tab === "WORKFORCE" ? <WorkforceSection /> : null}
      {selected_tab === "ROUTING" ? <RoutingSection /> : null}
      {selected_tab === "REGISTRY" ? <ActionRegistrySection /> : null}
      {selected_tab === "PROMPTS" ? <PromptVersionsSection /> : null}
      {selected_tab === "AUTONOMY" ? <EarnedAutonomySection /> : null}
    </>
  );
}
