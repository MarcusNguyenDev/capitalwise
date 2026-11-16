"use client";

import type { ReactNode } from "react";

import { fetchCustomerOverview } from "@/shared/api_client/engine_api.client";
import { formatCodeLabel, formatCurrency, formatDateTime } from "@/shared/format/format_values.util";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { CustomerOverview } from "@/shared/types/resources.type";
import { CareFlagChip, Chip } from "@/shared/ui/chip.component";
import { ErrorState, LoadingState } from "@/shared/ui/surface.component";

const NO_REFRESH_EVENTS: readonly string[] = [];
const RECENT_CONTACT_LIMIT = 3;

function CustomerAccounts({ overview }: { overview: CustomerOverview }) {
  return (
    <ul className="flex flex-col gap-1">
      {overview.accounts.map((account) => (
        <li key={account.account_id} className="flex items-baseline justify-between gap-3">
          <span className="truncate">{account.nickname || account.product_name}</span>
          <span className="font-semibold tabular-nums">{formatCurrency(account.current_balance)}</span>
        </li>
      ))}
    </ul>
  );
}

function CustomerCards({ overview }: { overview: CustomerOverview }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {overview.cards.map((card) => (
        <li key={card.card_id}>
          <Chip tone={card.status === "ACTIVE" ? "neutral" : "warning"}>
            {formatCodeLabel(card.card_type)} ···{card.last4} · {formatCodeLabel(card.status)}
          </Chip>
        </li>
      ))}
    </ul>
  );
}

function ContextSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
      {children}
    </div>
  );
}

/** What the bank knows about the caller: accounts, cards, care flags and recent contact. */
export function CustomerContext({ customer_id }: { customer_id: string }) {
  const overview_query = useLiveQuery(() => fetchCustomerOverview(customer_id), NO_REFRESH_EVENTS, customer_id);
  const overview = overview_query.data;

  if (overview_query.error_message) {
    return <ErrorState message={overview_query.error_message} />;
  }
  if (!overview) {
    return <LoadingState label="Loading customer context" />;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-ink-soft">
        <span>
          Age {overview.age} · customer for {Math.floor(overview.tenure_years)} {Math.floor(overview.tenure_years) === 1 ? "year" : "years"} · {overview.suburb}
        </span>
        {overview.has_care_flag ? <CareFlagChip /> : null}
      </div>
      {(overview.flags ?? []).map((flag) => (
        <p key={flag.flag_id} className="rounded-lg bg-warning-soft px-3 py-2 text-warning">
          <span className="font-semibold">{formatCodeLabel(flag.flag_type)}:</span> {flag.note}
        </p>
      ))}
      <ContextSection title="Accounts">
        <CustomerAccounts overview={overview} />
      </ContextSection>
      {overview.cards.length > 0 ? (
        <ContextSection title="Cards">
          <CustomerCards overview={overview} />
        </ContextSection>
      ) : null}
      <ContextSection title="Recent contact">
        {overview.recent_contacts.length === 0 ? <p className="text-ink-faint">No recent contact</p> : null}
        <ul className="flex flex-col gap-1.5">
          {overview.recent_contacts.slice(0, RECENT_CONTACT_LIMIT).map((contact) => (
            <li key={contact.contact_id} className="text-sm">
              <span className="text-ink-faint">{formatDateTime(contact.created_at)} · {formatCodeLabel(contact.channel)}</span>
              <span className="block">{contact.summary}</span>
            </li>
          ))}
        </ul>
      </ContextSection>
    </div>
  );
}
