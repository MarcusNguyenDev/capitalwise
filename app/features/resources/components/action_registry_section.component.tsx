"use client";

import { fetchActionRegistry } from "@/shared/api_client/engine_api.client";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { ErrorState, LoadingState } from "@/shared/ui/surface.component";

import { RegisteredActionCard } from "./registered_action_card.component";

export function ActionRegistrySection() {
  const registry_query = useLiveQuery(fetchActionRegistry, []);

  if (!registry_query.data) {
    return registry_query.error_message ? <ErrorState message={registry_query.error_message} /> : <LoadingState label="Loading the registry" />;
  }
  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-surface px-6 py-4 text-xl">
        <span className="font-bold">The AI proposes, deterministic policy decides, humans oversee.</span> These are the only actions the AI can
        propose, and the versioned rules that decide what happens to each one.
      </p>
      {registry_query.data.actions.map((registered_action) => (
        <RegisteredActionCard key={registered_action.action_code} registered_action={registered_action} />
      ))}
    </div>
  );
}
