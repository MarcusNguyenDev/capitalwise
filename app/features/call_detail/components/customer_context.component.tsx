"use client";

import type { ReactNode } from "react";

import { fetchCustomerOverview } from "@/shared/api_client/engine_api.client";
import { formatCodeLabel, formatCurrency, formatDateTime } from "@/shared/format/format_values.util";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { CareFlagBadge } from "@/shared/status/care_flag_badge.component";
import { Badge } from "@/shared/ui/badge.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { SkeletonDetail } from "@/shared/ui/skeleton.component";

const NO_REFRESH_EVENTS: readonly string[] = [];
const RECENT_CONTACT_LIMIT = 3;

function ContextSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold text-ink-faint">{title}</h3>
      {children}
    </section>
  );
}

/** What the bank knows about the caller: care flags first, then accounts, cards and recent contact. */
export function CustomerContext({ customer_id }: { customer_id: string }) {
  const overview_query = useLiveQuery(() => fetchCustomerOverview(customer_id), NO_REFRESH_EVENTS, customer_id);
  const overview = overview_query.data;

  if (overview_query.error_message) {
    return <ErrorState className="m-4" message={overview_query.error_message} onRetry={overview_query.reload} />;
  }
  if (!overview) {
    return <SkeletonDetail label="Loading the customer" />;
  }
  const tenure_years = Math.floor(overview.tenure_years);
  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <p className="font-semibold">{overview.full_name}</p>
        <p className="text-sm text-ink-soft">
          Age {overview.age} · customer for {tenure_years} {tenure_years === 1 ? "year" : "years"} · {overview.suburb}
        </p>
        {overview.has_care_flag ? (
          <div className="mt-2">
            <CareFlagBadge />
          </div>
        ) : null}
      </div>
      {(overview.flags ?? []).length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {overview.flags.map((flag) => (
            <li key={flag.flag_id} className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
              <span className="font-semibold">{formatCodeLabel(flag.flag_type)}:</span> {flag.note}
            </li>
          ))}
        </ul>
      ) : null}
      <ContextSection title="Accounts">
        <ul className="flex flex-col gap-1 text-sm">
          {overview.accounts.map((account) => (
            <li key={account.account_id} className="flex items-baseline justify-between gap-3">
              <span className="truncate">{account.nickname || account.product_name}</span>
              <span className="font-medium tabular-nums">{formatCurrency(account.current_balance)}</span>
            </li>
          ))}
        </ul>
      </ContextSection>
      {overview.cards.length > 0 ? (
        <ContextSection title="Cards">
          <ul className="flex flex-wrap gap-1.5">
            {overview.cards.map((card) => (
              <li key={card.card_id}>
                <Badge tone={card.status === "ACTIVE" ? "neutral" : "attention"}>
                  {formatCodeLabel(card.card_type)} ···{card.last4} · {formatCodeLabel(card.status)}
                </Badge>
              </li>
            ))}
          </ul>
        </ContextSection>
      ) : null}
      <ContextSection title="Recent contact">
        {overview.recent_contacts.length === 0 ? <p className="text-sm text-ink-faint">No recent contact.</p> : null}
        <ul className="flex flex-col gap-2">
          {overview.recent_contacts.slice(0, RECENT_CONTACT_LIMIT).map((contact) => (
            <li key={contact.contact_id} className="text-sm">
              <span className="text-xs text-ink-faint">
                {formatDateTime(contact.created_at)} · {formatCodeLabel(contact.channel)}
              </span>
              <span className="block">{contact.summary}</span>
            </li>
          ))}
        </ul>
      </ContextSection>
    </div>
  );
}
