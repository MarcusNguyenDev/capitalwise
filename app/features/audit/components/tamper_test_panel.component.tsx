"use client";

import { useState } from "react";

import { runAuditTamperTest } from "@/shared/api_client/engine_api.client";
import { describeError } from "@/shared/http/service_request.error";
import type { TamperTestResult } from "@/shared/types/case.type";
import { Button } from "@/shared/ui/button.component";
import { Chip } from "@/shared/ui/chip.component";
import { useToast } from "@/shared/ui/toast.provider";

function TamperTestOutcome({ tamper_result }: { tamper_result: TamperTestResult }) {
  return (
    <div className="mt-4 grid animate-slide-in grid-cols-2 gap-4">
      <div>
        <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-faint">SQL attempted</p>
        <pre className="whitespace-pre-wrap rounded-xl bg-ink px-4 py-3 font-mono text-[0.95rem] text-white">{tamper_result.attempted_sql}</pre>
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-faint">The database answered</p>
        {tamper_result.is_rejected ? (
          <div className="rounded-xl border-2 border-positive bg-positive-soft px-4 py-3">
            <p className="text-lg font-bold text-positive">✓ Rejected. The record was not changed.</p>
            <p className="mt-1 font-mono text-[0.95rem]">{tamper_result.database_error}</p>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-accent bg-accent-soft px-4 py-3 text-lg font-bold text-accent">
            The update was accepted. The audit log is not protected.
          </div>
        )}
      </div>
    </div>
  );
}

/** Proves the audit log is append-only by trying to alter a record and showing the database refuse. */
export function TamperTestPanel() {
  const { showToast } = useToast();
  const [tamper_result, setTamperResult] = useState<TamperTestResult | null>(null);
  const [is_running, setIsRunning] = useState(false);

  const attemptTamper = async () => {
    setIsRunning(true);
    setTamperResult(null);
    try {
      setTamperResult(await runAuditTamperTest());
    } catch (error) {
      showToast({ title: "The tamper test could not run", description: describeError(error), tone: "error" });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-4">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Chip tone="dark" className="px-4 py-1.5 text-base">
            🔒 Append-only, tamper-evident
          </Chip>
          <p className="text-lg text-ink-soft">
            Records can only be added. Database triggers reject every UPDATE and DELETE, even from the application itself.
          </p>
        </div>
        <Button variant="danger" className="shrink-0" disabled={is_running} onClick={attemptTamper}>
          {is_running ? "Trying…" : "Try to alter a record"}
        </Button>
      </div>
      {tamper_result ? <TamperTestOutcome tamper_result={tamper_result} /> : null}
    </div>
  );
}
