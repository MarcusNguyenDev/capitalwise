"use client";

import { Scale } from "lucide-react";

import { fetchActionRegistry } from "@/shared/api_client/engine_api.client";
import { formatCodeLabel } from "@/shared/format/format_values.util";
import { useListNavigation } from "@/shared/keyboard/use_list_navigation.hook";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { useQueryParam } from "@/shared/navigation/use_query_param.hook";
import { describeAction, formatActionLabel } from "@/shared/status/format_action_label.util";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { PageHeader } from "@/shared/ui/page_header.component";
import { QueueItem } from "@/shared/ui/queue_item.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";
import { SplitView } from "@/shared/ui/split_view.component";

import { ActionPolicyDetail } from "./action_policy_detail.component";

const NO_REFRESH_EVENTS: readonly string[] = [];
const ACTION_LIST_ELEMENT_ID = "registered_action_list";

/** Policies: the only actions the AI can propose, and the versioned rules that decide what happens to each. */
/** "identity level 2 · ", "no identity check · ", or nothing when the registry does not say. */
function describeIdentityRequirement(required_identity_level: number | undefined): string {
  if (required_identity_level === undefined) {
    return "";
  }
  return required_identity_level === 0 ? "no identity check · " : `identity level ${required_identity_level} · `;
}

export function PoliciesWorkspace() {
  const registry_query = useLiveQuery(fetchActionRegistry, NO_REFRESH_EVENTS);
  const [selected_action_code, setSelectedActionCode] = useQueryParam("action");
  const registered_actions = registry_query.data?.actions ?? [];
  const shown_action =
    registered_actions.find((registered_action) => registered_action.action_code === selected_action_code) ?? registered_actions[0] ?? null;
  const list_navigation = useListNavigation({
    item_ids: registered_actions.map((registered_action) => registered_action.action_code),
    selected_id: shown_action?.action_code ?? null,
    onOpen: setSelectedActionCode,
    list_element_id: ACTION_LIST_ELEMENT_ID,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Policies" description="The AI proposes, deterministic policy decides, people oversee. These are the only actions the AI can propose." />
      <SplitView
        list_label="Actions"
        has_selection={selected_action_code !== null}
        list={
          <div className="min-h-0 flex-1 overflow-y-auto">
            {registry_query.error_message ? <ErrorState className="m-3" message={registry_query.error_message} onRetry={registry_query.reload} /> : null}
            {registry_query.is_loading ? <SkeletonList label="Loading the registry" /> : null}
            <ul id={ACTION_LIST_ELEMENT_ID}>
              {registered_actions.map((registered_action) => (
                <QueueItem
                  key={registered_action.action_code}
                  item_id={registered_action.action_code}
                  is_selected={registered_action.action_code === shown_action?.action_code}
                  is_highlighted={registered_action.action_code === list_navigation.highlighted_id}
                  onOpen={() => setSelectedActionCode(registered_action.action_code)}
                >
                  <span className="block font-semibold">{formatActionLabel(registered_action.action_code)}</span>
                  <span className="block truncate text-sm text-ink-soft">{describeAction(registered_action.action_code, registered_action.description)}</span>
                  <span className="block text-xs text-ink-faint">
                    {formatCodeLabel(registered_action.risk_class)} risk ·{" "}
                    {describeIdentityRequirement(registered_action.required_identity_level)}
                    {registered_action.active_policy ? `v${registered_action.active_policy.version} active` : "no active policy"}
                  </span>
                </QueueItem>
              ))}
            </ul>
          </div>
        }
        detail={
          shown_action ? (
            <ActionPolicyDetail key={shown_action.action_code} registered_action={shown_action} onClose={() => setSelectedActionCode(null)} />
          ) : (
            <EmptyState className="flex-1" icon={<Scale aria-hidden />} title="Pick an action to see its policy" />
          )
        }
      />
    </div>
  );
}
