"use client";

import { ChevronDown, IdCard } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";

import { formatCalendarDate, formatCurrency } from "@/shared/format/format_values.util";
import type { CallerDetails } from "@/shared/types/resources.type";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

import { formatMobileNumber } from "../format_mobile_number.util";
import { useCallerDetails } from "../hooks/use_caller_details.hook";

/** Enough shop names to answer "where did you use your card this week?" without a wall of text. */
const MERCHANTS_SHOWN = 3;

const INCOME_LABELS: Record<NonNullable<CallerDetails["last_income"]>["kind"], string> = {
  SALARY: "Last pay",
  GOVT_BENEFIT: "Last pension",
};

/** LIGHT sits in the demo controls; DARK sits on the in-call phone screen. */
type DetailsTone = "LIGHT" | "DARK";

const TONE_CLASS_NAMES: Record<DetailsTone, { label: string; heading: string; divider: string }> = {
  LIGHT: { label: "text-ink-soft", heading: "text-ink-faint", divider: "border-line" },
  DARK: { label: "text-white/60", heading: "text-white/60", divider: "border-white/10" },
};

function DetailRow({ label, tone, children }: { label: string; tone: DetailsTone; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className={joinClassNames("shrink-0", TONE_CLASS_NAMES[tone].label)}>{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function describeIncome(last_income: NonNullable<CallerDetails["last_income"]>): string {
  const amount = formatCurrency(last_income.amount);
  return last_income.posted_at ? `${amount} on ${formatCalendarDate(last_income.posted_at)}` : amount;
}

function BasicDetails({ caller_details, tone }: { caller_details: CallerDetails; tone: DetailsTone }) {
  return (
    <dl>
      <DetailRow label="Name" tone={tone}>
        {caller_details.full_name}
      </DetailRow>
      <DetailRow label="Date of birth" tone={tone}>
        {formatCalendarDate(caller_details.date_of_birth)}
      </DetailRow>
      <DetailRow label="Postcode" tone={tone}>
        {caller_details.postcode}
      </DetailRow>
    </dl>
  );
}

function MoreDetails({ caller_details, tone }: { caller_details: CallerDetails; tone: DetailsTone }) {
  const { last_income, card_last_fours, recent_card_merchants, loan_repayment_amounts } = caller_details;
  return (
    <>
      <dl className={joinClassNames("border-t pt-1", TONE_CLASS_NAMES[tone].divider)}>
        <DetailRow label="Address" tone={tone}>
          {caller_details.street_address}, {caller_details.suburb} {caller_details.state} {caller_details.postcode}
        </DetailRow>
        <DetailRow label="Mobile" tone={tone}>
          {formatMobileNumber(caller_details.mobile_phone)}
        </DetailRow>
      </dl>
      <p className={joinClassNames("mt-2 text-[0.7rem] font-semibold uppercase tracking-wide", TONE_CLASS_NAMES[tone].heading)}>
        If asked one more security question
      </p>
      <dl>
        {last_income ? (
          <DetailRow label={INCOME_LABELS[last_income.kind]} tone={tone}>
            {describeIncome(last_income)}
          </DetailRow>
        ) : null}
        {recent_card_merchants.length > 0 ? (
          <DetailRow label="Card used at" tone={tone}>
            {recent_card_merchants.slice(0, MERCHANTS_SHOWN).join(", ")}
          </DetailRow>
        ) : null}
        {loan_repayment_amounts.length > 0 ? (
          <DetailRow label="Loan repayment" tone={tone}>
            {loan_repayment_amounts.map((amount) => formatCurrency(amount)).join(", ")}
          </DetailRow>
        ) : null}
        {card_last_fours.length > 0 ? (
          <DetailRow label="Card ends in" tone={tone}>
            {card_last_fours.join(", ")}
          </DetailRow>
        ) : null}
      </dl>
    </>
  );
}

/**
 * Demo controls: everything the selected caller knows about themselves, so
 * whoever plays them can answer the AI's security questions. The AI never
 * sees this. `refresh_key` reloads it (a call ending can change the card).
 */
export function CallerDetailsPanel({ customer_id, refresh_key }: { customer_id: string; refresh_key: string }) {
  const details_query = useCallerDetails(customer_id, refresh_key);
  const caller_details = details_query.data;

  return (
    <section aria-label="Caller's details" className="flex flex-col gap-1 text-sm">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <IdCard className="size-4 text-ink-faint" aria-hidden />
        {caller_details ? `${caller_details.full_name.split(" ")[0]}'s details` : "Caller's details"}
      </p>
      <p className="text-xs text-ink-soft">Use these to answer the AI&apos;s security questions. The AI can&apos;t see them.</p>
      {caller_details ? (
        <div className="mt-1">
          <BasicDetails caller_details={caller_details} tone="LIGHT" />
          <MoreDetails caller_details={caller_details} tone="LIGHT" />
        </div>
      ) : (
        <p className="text-xs text-ink-soft">{details_query.error_message ? `Not available: ${details_query.error_message}` : "Loading…"}</p>
      )}
    </section>
  );
}

/**
 * The same details on the in-call phone screen, for small screens where the
 * demo controls are tucked away: name, date of birth and postcode in view,
 * the rest on tap.
 */
export function CallerDetailsCard({ customer_id }: { customer_id: string }) {
  const [is_expanded, setIsExpanded] = useState(false);
  const details_query = useCallerDetails(customer_id);
  const more_details_id = useId();
  const caller_details = details_query.data;

  if (!caller_details) {
    return null;
  }

  return (
    <section aria-label="Your details" className="mx-4 mt-3 animate-slide-down rounded-xl bg-white/10 px-4 py-2.5 text-left text-sm md:hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!is_expanded)}
        aria-expanded={is_expanded}
        aria-controls={more_details_id}
        className="flex w-full items-center gap-2 text-left"
      >
        <IdCard className="size-4 shrink-0 text-white/70" aria-hidden />
        <span className="flex-1 text-[0.7rem] font-semibold uppercase tracking-wide text-white/60">Your details · demo only</span>
        <span className="text-xs text-white/60">{is_expanded ? "Less" : "More"}</span>
        <ChevronDown className={joinClassNames("size-4 shrink-0 text-white/60 transition-transform", is_expanded && "rotate-180")} aria-hidden />
      </button>
      <div className="mt-1">
        <BasicDetails caller_details={caller_details} tone="DARK" />
      </div>
      <div id={more_details_id} hidden={!is_expanded} className="max-h-48 overflow-y-auto">
        {is_expanded ? <MoreDetails caller_details={caller_details} tone="DARK" /> : null}
      </div>
    </section>
  );
}
