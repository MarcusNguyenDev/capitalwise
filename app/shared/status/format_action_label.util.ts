import { formatCodeLabel } from "@/shared/format/format_values.util";

import { ACTION_DESCRIPTIONS, ACTION_LABELS } from "./status_wording.constant";

/** "REPLACE_CARD" -> "Order a replacement card"; an action code this app does not know yet reads as its code. */
export function formatActionLabel(action_code: string | null | undefined): string {
  return (action_code && ACTION_LABELS[action_code as keyof typeof ACTION_LABELS]) || formatCodeLabel(action_code);
}

export function describeAction(action_code: string, fallback_description: string): string {
  return ACTION_DESCRIPTIONS[action_code as keyof typeof ACTION_DESCRIPTIONS] ?? fallback_description;
}
