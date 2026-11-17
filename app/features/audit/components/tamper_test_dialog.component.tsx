"use client";

import { CircleCheck, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { runAuditTamperTest } from "@/shared/api_client/engine_api.client";
import { describeError } from "@/shared/http/service_request.error";
import type { TamperTestResult } from "@/shared/types/case.type";
import { Button } from "@/shared/ui/button.component";
import { Dialog } from "@/shared/ui/dialog.component";
import { ErrorState } from "@/shared/ui/error_state.component";

function TamperTestOutcome({ tamper_result }: { tamper_result: TamperTestResult }) {
  return (
    <div className="flex animate-slide-in flex-col gap-3" role="status">
      <div>
        <p className="mb-1 text-xs font-semibold text-ink-faint">What we tried</p>
        <pre className="whitespace-pre-wrap rounded-md bg-ink px-3 py-2 font-mono text-xs text-white">{tamper_result.attempted_sql}</pre>
      </div>
      {tamper_result.is_rejected ? (
        <div className="rounded-md border border-positive/30 bg-positive-soft px-3 py-2">
          <p className="flex items-center gap-2 font-semibold text-positive">
            <CircleCheck className="size-4" aria-hidden />
            The database refused. The record was not changed.
          </p>
          <p className="mt-1 font-mono text-xs text-ink-soft">{tamper_result.database_error}</p>
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent-soft px-3 py-2 font-semibold text-accent">
          <TriangleAlert className="size-4" aria-hidden />
          The update was accepted. The audit log is not protected.
        </p>
      )}
    </div>
  );
}

/** Proves the audit log is append-only: tries to alter a record and shows the database's answer. */
export function TamperTestDialog() {
  const [is_open, setIsOpen] = useState(false);
  const [tamper_result, setTamperResult] = useState<TamperTestResult | null>(null);
  const [error_message, setErrorMessage] = useState<string | null>(null);
  const [is_running, setIsRunning] = useState(false);

  const attemptTamper = async () => {
    setIsRunning(true);
    setTamperResult(null);
    setErrorMessage(null);
    try {
      setTamperResult(await runAuditTamperTest());
    } catch (error) {
      setErrorMessage(describeError(error));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <Button icon={<ShieldCheck className="size-4" aria-hidden />} onClick={() => setIsOpen(true)}>
        Verify tamper protection
      </Button>
      <Dialog
        is_open={is_open}
        onOpenChange={setIsOpen}
        title="Verify tamper protection"
        description="Records can only be added. Database triggers reject every UPDATE and DELETE, even from the application itself. Try it:"
        footer={
          <>
            <Button onClick={() => setIsOpen(false)}>Close</Button>
            <Button variant="primary" is_loading={is_running} onClick={() => void attemptTamper()}>
              Try to alter a record
            </Button>
          </>
        }
      >
        {tamper_result ? <TamperTestOutcome tamper_result={tamper_result} /> : null}
        {error_message ? <ErrorState title="The test could not run" message={error_message} /> : null}
        {!tamper_result && !error_message ? <p className="text-sm text-ink-soft">Nothing has been changed yet.</p> : null}
      </Dialog>
    </>
  );
}
