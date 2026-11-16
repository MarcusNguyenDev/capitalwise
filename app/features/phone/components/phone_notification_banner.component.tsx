import type { CustomerNotification } from "@/shared/types/case.type";

interface PhoneNotificationBannerProps {
  notification: CustomerNotification;
  bank_name: string;
  onRespond: (notification_id: string, response: "APPROVED" | "DENIED") => void;
  onDismiss: (notification_id: string) => void;
}

/** A push or SMS banner sliding down from the top of the phone screen. */
export function PhoneNotificationBanner({ notification, bank_name, onRespond, onDismiss }: PhoneNotificationBannerProps) {
  const is_identity_check = notification.kind === "IDENTITY_CHECK";

  return (
    <div className="animate-slide-down rounded-2xl bg-white/95 p-4 text-ink shadow-2xl ring-1 ring-black/10 backdrop-blur" role="alert">
      <div className="flex items-center justify-between text-sm text-ink-faint">
        <span className="flex items-center gap-2 font-semibold uppercase tracking-wide">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent text-xs font-black text-white">{bank_name.charAt(0)}</span>
          {is_identity_check ? `${bank_name} app` : "Messages"}
        </span>
        {is_identity_check ? (
          <span>now</span>
        ) : (
          <button type="button" aria-label="Dismiss" className="text-lg leading-none" onClick={() => onDismiss(notification.notification_id)}>
            ×
          </button>
        )}
      </div>
      <p className={`mt-1.5 ${is_identity_check ? "text-lg font-semibold" : ""}`}>{notification.body}</p>
      {is_identity_check ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="rounded-xl border border-line py-2.5 font-semibold text-ink-soft hover:bg-surface"
            onClick={() => onRespond(notification.notification_id, "DENIED")}
          >
            Deny
          </button>
          <button
            type="button"
            className="animate-attention rounded-xl bg-accent py-2.5 font-semibold text-white hover:bg-accent-dark"
            onClick={() => onRespond(notification.notification_id, "APPROVED")}
          >
            Approve
          </button>
        </div>
      ) : null}
    </div>
  );
}
