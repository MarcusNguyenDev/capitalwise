import { formatClockTime } from "@/shared/format/format_values.util";
import type { CustomerNotification } from "@/shared/types/case.type";
import { Chip } from "@/shared/ui/chip.component";

const IDENTITY_STATUS_LABELS: Record<CustomerNotification["status"], string> = {
  SENT: "Waiting",
  APPROVED: "Approved",
  DENIED: "Denied",
  EXPIRED: "Expired",
};

export function NotificationHistory({ notifications }: { notifications: CustomerNotification[] }) {
  if (notifications.length === 0) {
    return <p className="text-ink-faint">Identity checks and SMS updates for this customer will appear here.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {notifications.map((notification) => (
        <li key={notification.notification_id} className="animate-slide-in rounded-xl border border-line bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm text-ink-faint">
            <span className="font-semibold uppercase tracking-wide">{notification.channel === "SMS" ? "SMS" : "App notification"}</span>
            <span>{formatClockTime(notification.created_at)}</span>
          </div>
          <p className="mt-1">{notification.body}</p>
          {notification.kind === "IDENTITY_CHECK" ? (
            <Chip tone={notification.status === "APPROVED" ? "positive" : "neutral"} className="mt-2">
              {IDENTITY_STATUS_LABELS[notification.status]}
            </Chip>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
