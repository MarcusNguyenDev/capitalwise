import { X } from "lucide-react";

import type { CustomerNotification } from "@/shared/types/case.type";

interface PhoneNotificationBannerProps {
  notification: CustomerNotification;
  bank_name: string;
  onRespond: (notification_id: string, response: "APPROVED" | "DENIED") => void;
  onDismiss: (notification_id: string) => void;
}

/** A push or SMS banner sliding down from the top of the phone screen. Identity checks need Approve or Deny. */
export function PhoneNotificationBanner({ notification, bank_name, onRespond, onDismiss }: PhoneNotificationBannerProps) {
  const is_identity_check = notification.kind === "IDENTITY_CHECK";

  return (
    <div
      className="animate-slide-down rounded-2xl bg-white/95 p-4 text-ink shadow-overlay ring-1 ring-black/10 backdrop-blur"
      role={is_identity_check ? "alertdialog" : "status"}
      aria-label={is_identity_check ? `${bank_name} identity check` : "New message"}
    >
      <div className="flex items-center justify-between text-xs text-ink-faint">
        <span className="flex items-center gap-2 font-semibold uppercase tracking-wide">
          <span className="flex size-5 items-center justify-center rounded-md bg-accent text-[0.65rem] font-black text-white" aria-hidden>
            {bank_name.charAt(0)}
          </span>
          {is_identity_check ? `${bank_name} app` : "Messages"}
        </span>
        {is_identity_check ? (
          <span>now</span>
        ) : (
          <button type="button" aria-label="Dismiss message" className="inline-flex size-6 items-center justify-center rounded-full hover:bg-surface" onClick={() => onDismiss(notification.notification_id)}>
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      <p className={is_identity_check ? "mt-1.5 font-semibold" : "mt-1.5 text-sm"}>{notification.body}</p>
      {is_identity_check ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="h-10 rounded-xl border border-line-strong text-sm font-semibold text-ink-soft hover:bg-surface"
            onClick={() => onRespond(notification.notification_id, "DENIED")}
          >
            Deny
          </button>
          <button
            type="button"
            autoFocus
            className="h-10 rounded-xl bg-accent text-sm font-semibold text-white hover:bg-accent-dark"
            onClick={() => onRespond(notification.notification_id, "APPROVED")}
          >
            Approve
          </button>
        </div>
      ) : null}
    </div>
  );
}
