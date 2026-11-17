import type { AiAgent } from "@/shared/types/resources.type";
import { Badge } from "@/shared/ui/badge.component";
import { DataTable } from "@/shared/ui/data_table.component";

import { UtilisationBar } from "./utilisation_bar.component";

/** The AI specialist instances, their model and prompt, and how many calls each is carrying. */
export function AiAgentTable({ ai_agents }: { ai_agents: AiAgent[] }) {
  return (
    <DataTable<AiAgent>
      caption="AI agents"
      rows={ai_agents}
      readRowKey={(ai_agent) => ai_agent.agent_id}
      columns={[
        { key: "name", header: "Agent", class_name: "font-medium", renderCell: (ai_agent) => ai_agent.display_name },
        {
          key: "model",
          header: "Model and prompt",
          renderCell: (ai_agent) => (
            <span className="text-ink-soft">
              <span className="font-mono text-xs">{ai_agent.model}</span> · prompt {ai_agent.prompt_version}
            </span>
          ),
        },
        {
          key: "status",
          header: "Status",
          renderCell: (ai_agent) => (
            <Badge tone={ai_agent.status === "ONLINE" ? "positive" : "neutral"} has_dot>
              {ai_agent.status === "ONLINE" ? "Online" : "Paused"}
            </Badge>
          ),
        },
        {
          key: "calls",
          header: "Live calls",
          renderCell: (ai_agent) => (
            <UtilisationBar label={`Live calls on ${ai_agent.display_name}`} used_count={ai_agent.active_call_count} capacity={ai_agent.max_concurrent_calls} />
          ),
        },
      ]}
    />
  );
}
