"use client";

import Link from "next/link";

import { fetchCallIdentity } from "@/shared/api_client/engine_api.client";
import { LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { CallIdentityBadge } from "@/shared/status/call_identity_badge.component";
import { describeCallIdentity, describeFailedAttempts } from "@/shared/status/describe_call_identity.util";
import { CALL_IDENTITY_DESCRIPTIONS } from "@/shared/status/status_wording.constant";
import type { LiveCall } from "@/shared/types/call.type";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

// A failed answer adds a tool turn but does not change the call row, so turns trigger the refresh.
const IDENTITY_REFRESH_EVENTS = [LIVE_EVENT.CALL_TURN] as const;

/** How far the caller has confirmed who they are, how, and how many answers failed to match. */
export function CallIdentitySummary({ call }: { call: LiveCall }) {
  const identity_state = describeCallIdentity(call);
  const identity_query = useLiveQuery(
    () => fetchCallIdentity(call.call_id),
    IDENTITY_REFRESH_EVENTS,
    `${call.call_id}:${call.identity_level}:${call.is_identity_locked}`,
  );
  const failed_attempt_count = identity_query.data?.failed_attempts ?? call.identity_failed_attempts ?? 0;
  const concern_case_number = identity_query.data?.concern_case_number ?? null;

  return (
    <section aria-label="Identity">
      <h3 className="text-xs font-semibold text-ink-faint">Identity</h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <CallIdentityBadge call={call} />
        {failed_attempt_count > 0 ? (
          <span className={joinClassNames("text-sm font-medium", identity_state === "LOCKED" ? "text-accent" : "text-warning")}>{describeFailedAttempts(failed_attempt_count)}</span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {CALL_IDENTITY_DESCRIPTIONS[identity_state]}
        {concern_case_number ? (
          <>
            {" "}
            Fraud case{" "}
            <Link href={`/approvals?case=${concern_case_number}`} className="font-mono text-xs font-semibold text-info hover:underline">
              {concern_case_number}
            </Link>
            .
          </>
        ) : null}
      </p>
    </section>
  );
}
