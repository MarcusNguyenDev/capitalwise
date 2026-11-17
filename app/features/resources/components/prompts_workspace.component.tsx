"use client";

import { ArrowLeft, FileText } from "lucide-react";

import { fetchPromptVersions } from "@/shared/api_client/engine_api.client";
import { formatDateTime } from "@/shared/format/format_values.util";
import { useListNavigation } from "@/shared/keyboard/use_list_navigation.hook";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { useQueryParam } from "@/shared/navigation/use_query_param.hook";
import type { PromptVersion } from "@/shared/types/resources.type";
import { Badge } from "@/shared/ui/badge.component";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { IconButton } from "@/shared/ui/icon_button.component";
import { PageHeader } from "@/shared/ui/page_header.component";
import { QueueItem } from "@/shared/ui/queue_item.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";
import { SplitView } from "@/shared/ui/split_view.component";

const NO_REFRESH_EVENTS: readonly string[] = [];
const PROMPT_LIST_ELEMENT_ID = "prompt_version_list";

function PromptDetail({ prompt_version, onClose }: { prompt_version: PromptVersion; onClose: () => void }) {
  return (
    <article aria-label={`Prompt ${prompt_version.version}`} className="flex min-h-0 flex-1 animate-fade-in flex-col">
      <header className="flex items-start gap-4 border-b border-line bg-white px-5 py-3.5">
        <IconButton label="Back to the list" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={onClose} className="lg:hidden" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Prompt {prompt_version.version}</h2>
            {prompt_version.is_active ? <Badge tone="positive">Active on every AI agent</Badge> : <Badge>Superseded</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            {prompt_version.change_note} · {formatDateTime(prompt_version.created_at)}
          </p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <pre className="mx-auto max-w-4xl whitespace-pre-wrap rounded-lg border border-line bg-white px-5 py-4 font-mono text-sm leading-relaxed">{prompt_version.content}</pre>
      </div>
    </article>
  );
}

/** Prompt versions: the AI specialist's instructions, with every earlier version and why it changed. */
export function PromptsWorkspace() {
  const prompts_query = useLiveQuery(fetchPromptVersions, NO_REFRESH_EVENTS);
  const [selected_version, setSelectedVersion] = useQueryParam("version");
  const prompt_versions = prompts_query.data ?? [];
  const active_prompt = prompt_versions.find((prompt_version) => prompt_version.is_active) ?? prompt_versions[0] ?? null;
  const shown_prompt = prompt_versions.find((prompt_version) => prompt_version.version === selected_version) ?? active_prompt;
  const list_navigation = useListNavigation({
    item_ids: prompt_versions.map((prompt_version) => prompt_version.version),
    selected_id: shown_prompt?.version ?? null,
    onOpen: setSelectedVersion,
    list_element_id: PROMPT_LIST_ELEMENT_ID,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Prompt versions" description="What the AI specialist is told, version by version. Every decision records the prompt version it used." />
      <SplitView
        list_label="Prompt versions"
        has_selection={selected_version !== null}
        list={
          <div className="min-h-0 flex-1 overflow-y-auto">
            {prompts_query.error_message ? <ErrorState className="m-3" message={prompts_query.error_message} onRetry={prompts_query.reload} /> : null}
            {prompts_query.is_loading ? <SkeletonList label="Loading prompt versions" /> : null}
            <ul id={PROMPT_LIST_ELEMENT_ID}>
              {prompt_versions.map((prompt_version) => (
                <QueueItem
                  key={prompt_version.version}
                  item_id={prompt_version.version}
                  is_selected={prompt_version.version === shown_prompt?.version}
                  is_highlighted={prompt_version.version === list_navigation.highlighted_id}
                  onOpen={() => setSelectedVersion(prompt_version.version)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Version {prompt_version.version}</span>
                    {prompt_version.is_active ? <Badge tone="positive">Active</Badge> : null}
                  </span>
                  <span className="block text-sm text-ink-soft">{prompt_version.change_note}</span>
                  <span className="block text-xs text-ink-faint">{formatDateTime(prompt_version.created_at)}</span>
                </QueueItem>
              ))}
            </ul>
          </div>
        }
        detail={
          shown_prompt ? (
            <PromptDetail key={shown_prompt.version} prompt_version={shown_prompt} onClose={() => setSelectedVersion(null)} />
          ) : (
            <EmptyState className="flex-1" icon={<FileText aria-hidden />} title="No prompt versions are recorded" />
          )
        }
      />
    </div>
  );
}
