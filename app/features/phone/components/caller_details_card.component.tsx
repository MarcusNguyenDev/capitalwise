"use client";

import { ChevronDown, IdCard } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";

import { formatCalendarDate, formatCurrency } from "@/shared/format/format_values.util";
import type { CallerDetails } from "@/shared/types/resources.type";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

import { useCallerDetails } from "../hooks/use_caller_details.hook";

/** Enough shop names to answer "where did you use your card this week?" without a wall of text. */
const MERCHANTS_SHOWN = 3;

const INCOME_LABELS: Record<NonNullable<CallerDetails["last_income"]>["kind"], string> = {
  SALARY: "Last pay",
  GOVT_BENEFIT: "Last pension",
};

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="shrink-0 text-white/60">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function describeIncome(last_income: NonNullable<CallerDetails["last_income"]>): string {
  const amount = formatCurrency(last_income.amount);
  return last_income.posted_at ? `${amount} on ${formatCalendarDate(last_income.posted_at)}` : amount;
}

function MoreDetails({ caller_details }: { caller_details: CallerDetails }) {
  const { last_income, card_last_fours, recent_card_merchants, loan_repayment_amounts } = caller_details;
  return (
    <>
      <dl className="border-t border-white/10 pt-1">
        <DetailRow label="Address">
          {caller_details.street_address}, {caller_details.suburb} {caller_details.state} {caller_details.postcode}
        </DetailRow>
        <DetailRow label="Mobile">{caller_details.mobile_phone}</DetailRow>
      </dl>
      <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-wide text-white/60">If asked one more security question</p>
      <dl>
        {last_income ? <DetailRow label={INCOME_LABELS[last_income.kind]}>{describeIncome(last_income)}</DetailRow> : null}
        {recent_card_merchants.length > 0 ? (
          <DetailRow label="Card used at">{recent_card_merchants.slice(0, MERCHANTS_SHOWN).join(", ")}</DetailRow>
        ) : null}
        {loan_repayment_amounts.length > 0 ? (
          <DetailRow label="Loan repayment">{loan_repayment_amounts.map((amount) => formatCurrency(amount)).join(", ")}</DetailRow>
        ) : null}
        {card_last_fours.length > 0 ? <DetailRow label="Card ends in">{card_last_fours.join(", ")}</DetailRow> : null}
      </dl>
    </>
  );
}

/**
 * Demo only: the caller's own details, so whoever plays the caller can answer
 * the AI's security questions. The name, date of birth and postcode are
 * always in view; the rest opens on tap. The AI never sees this card.
 */
export function CallerDetailsCard({ customer_id }: { customer_id: string }) {
  const [is_expanded, setIsExpanded] = useState(false);
  const details_query = useCallerDetails(customer_id);
  const more_details_id = useId();
  const caller_details = details_query.data;

  if (!caller_details) {
    return details_query.error_message ? (
      <p className="mx-4 mt-3 rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white/75" role="status">
        Your details are not available: {details_query.error_message}
      </p>
    ) : null;
  }

  return (
    <section aria-label="Your details" className="mx-4 mt-3 animate-slide-down rounded-xl bg-white/10 px-4 py-2.5 text-left text-sm">
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
      <dl className="mt-1">
        <DetailRow label="Name">{caller_details.full_name}</DetailRow>
        <DetailRow label="Date of birth">{formatCalendarDate(caller_details.date_of_birth)}</DetailRow>
        <DetailRow label="Postcode">{caller_details.postcode}</DetailRow>
      </dl>
      <div id={more_details_id} hidden={!is_expanded} className="max-h-48 overflow-y-auto">
        {is_expanded ? <MoreDetails caller_details={caller_details} /> : null}
      </div>
    </section>
  );
}
