"use client";

import { useState } from "react";

import { resetDemo } from "@/shared/api_client/engine_api.client";
import { describeError } from "@/shared/http/service_request.error";
import { ConfirmDialog } from "@/shared/ui/confirm_dialog.component";
import { useToast } from "@/shared/ui/toast.provider";

/** Reseeding wipes every decision made today, so it always asks first. */
export function ResetDemoDialog({ is_open, onOpenChange }: { is_open: boolean; onOpenChange: (is_open: boolean) => void }) {
  const [is_resetting, setIsResetting] = useState(false);
  const { showToast } = useToast();

  const confirmReset = async () => {
    setIsResetting(true);
    try {
      await resetDemo();
      showToast({ title: "Demo data reset", description: "The database was reseeded and the simulator stopped.", tone: "success" });
      onOpenChange(false);
    } catch (error) {
      showToast({ title: "Reset failed", description: describeError(error), tone: "error" });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <ConfirmDialog
      is_open={is_open}
      onOpenChange={onOpenChange}
      title="Reset the demo data?"
      description="This reseeds the database for everyone using this demo: decisions, calls and audit records made since the last reset are replaced, and the simulator stops."
      confirm_label="Reset demo data"
      is_destructive
      is_busy={is_resetting}
      onConfirm={() => void confirmReset()}
    />
  );
}
