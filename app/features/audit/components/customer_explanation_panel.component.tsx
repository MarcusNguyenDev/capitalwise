"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button.component";

/** The same decision in plain English, generated from a fixed template (no model involved). */
export function CustomerExplanationPanel({ customer_explanation }: { customer_explanation: string }) {
  const [is_shown, setIsShown] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-5">
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-xl font-bold">Explain to customer</p>
          <p className="text-ink-soft">A plain-English version of this decision that staff can read out or send. Written from a fixed template, not by the AI.</p>
        </div>
        <Button variant="primary" size="large" className="shrink-0" onClick={() => setIsShown((was_shown) => !was_shown)}>
          {is_shown ? "Hide explanation" : "Explain to customer"}
        </Button>
      </div>
      {is_shown ? (
        <p className="mt-4 animate-slide-in whitespace-pre-line rounded-xl border-l-4 border-accent bg-white px-5 py-4 text-xl leading-relaxed">
          {customer_explanation}
        </p>
      ) : null}
    </div>
  );
}
