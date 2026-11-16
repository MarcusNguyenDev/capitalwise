import type { AiAgent } from "@/shared/types/resources.type";
import { Chip } from "@/shared/ui/chip.component";

import { UtilisationBar } from "./utilisation_bar.component";

export function AiAgentCard({ ai_agent }: { ai_agent: AiAgent }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">{ai_agent.display_name}</h3>
          <p className="font-mono text-sm text-ink-soft">
            {ai_agent.model} · prompt {ai_agent.prompt_version}
          </p>
        </div>
        <Chip tone={ai_agent.status === "ONLINE" ? "positive" : "neutral"}>{ai_agent.status === "ONLINE" ? "Online" : "Paused"}</Chip>
      </div>
      <div className="mt-4">
        <UtilisationBar label="Live calls" used_count={ai_agent.active_call_count} capacity={ai_agent.max_concurrent_calls} />
      </div>
    </section>
  );
}
