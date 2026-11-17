"use client";

import type { ReactNode } from "react";

import { Button } from "./button.component";
import { Dialog } from "./dialog.component";

interface ConfirmDialogProps {
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  title: string;
  description: ReactNode;
  confirm_label: string;
  is_destructive?: boolean;
  is_busy?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}

/** Asks before an action that cannot be taken back. Cancel has focus first so Enter never destroys by accident. */
export function ConfirmDialog({
  is_open,
  onOpenChange,
  title,
  description,
  confirm_label,
  is_destructive = false,
  is_busy = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      is_open={is_open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width="small"
      footer={
        <>
          <Button data-autofocus onClick={() => onOpenChange(false)} disabled={is_busy}>
            Cancel
          </Button>
          <Button variant={is_destructive ? "danger" : "primary"} is_loading={is_busy} onClick={onConfirm}>
            {confirm_label}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
