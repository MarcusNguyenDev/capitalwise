"use client";

import { useState } from "react";

import { fetchPromptVersions } from "@/shared/api_client/engine_api.client";
import { formatDateTime } from "@/shared/format/format_values.util";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { PromptVersion } from "@/shared/types/resources.type";
import { Chip } from "@/shared/ui/chip.component";
import { Card, EmptyState, ErrorState, LoadingState } from "@/shared/ui/surface.component";

interface PromptVersionListProps {
  prompt_versions: PromptVersion[];
  selected_version: string | undefined;
  onSelect: (version: string) => void;
}

function PromptVersionList({ prompt_versions, selected_version, onSelect }: PromptVersionListProps) {
  return (
    <ul className="space-y-2">
      {prompt_versions.map((prompt_version) => {
        const is_selected = prompt_version.version === selected_version;
        return (
          <li key={prompt_version.version}>
            <button
              type="button"
              aria-pressed={is_selected}
              className={`w-full rounded-xl border px-4 py-3 text-left ${is_selected ? "border-accent bg-accent-soft/50" : "border-line bg-white hover:bg-surface"}`}
              onClick={() => onSelect(prompt_version.version)}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-mono text-lg font-bold">{prompt_version.version}</span>
                {prompt_version.is_active ? <Chip tone="positive">Active</Chip> : <Chip>Superseded</Chip>}
              </span>
              <span className="mt-1 block">{prompt_version.change_note}</span>
              <span className="block text-sm text-ink-faint">{formatDateTime(prompt_version.created_at)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function PromptVersionsSection() {
  const prompts_query = useLiveQuery(fetchPromptVersions, []);
  const [chosen_version, setChosenVersion] = useState<string | null>(null);
  const prompt_versions = prompts_query.data;

  if (!prompt_versions) {
    return prompts_query.error_message ? <ErrorState message={prompts_query.error_message} /> : <LoadingState label="Loading prompt versions" />;
  }
  const active_prompt = prompt_versions.find((prompt_version) => prompt_version.is_active) ?? prompt_versions[0];
  const selected_prompt = prompt_versions.find((prompt_version) => prompt_version.version === chosen_version) ?? active_prompt;
  if (!selected_prompt) {
    return <EmptyState title="No prompt versions are recorded" />;
  }
  return (
    <div className="grid grid-cols-[26rem_1fr] items-start gap-6">
      <PromptVersionList prompt_versions={prompt_versions} selected_version={selected_prompt.version} onSelect={setChosenVersion} />
      <Card>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-2xl font-bold">Prompt {selected_prompt.version}</h3>
          {selected_prompt.is_active ? <Chip tone="positive">Active on every AI agent</Chip> : <Chip>Superseded</Chip>}
        </div>
        <p className="mb-4 text-lg text-ink-soft">Change note: {selected_prompt.change_note}</p>
        <pre className="max-h-[calc(100vh-26rem)] overflow-auto whitespace-pre-wrap rounded-xl bg-surface px-5 py-4 font-mono text-[0.95rem] leading-relaxed">
          {selected_prompt.content}
        </pre>
      </Card>
    </div>
  );
}
