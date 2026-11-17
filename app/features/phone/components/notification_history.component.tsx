import { Bell, Mail, MessageSquareText } from "lucide-react";

import { formatClockTime } from "@/shared/format/format_values.util";
import type { CustomerNotification } from "@/shared/types/case.type";

const CHANNEL_DISPLAY: Record<CustomerNotification["channel"], { label: string; Icon: typeof Bell }> = {
  APP_PUSH: { label: "App", Icon: Bell },
  SMS: { label: "Messages", Icon: MessageSquareText },
  LETTER: { label: "Letter in the post", Icon: Mail },
};

const IDENTITY_STATUS_LABELS: Record<CustomerNotification["status"], string> = {
  SENT: "Waiting for you",
  APPROVED: "You approved",
  DENIED: "You denied",
  EXPIRED: "Expired",
};

/** The phone's recent notifications, like a lock screen: texts, letters and any app checks from the bank. */
export function NotificationHistory({ notifications }: { notifications: CustomerNotification[] }) {
  if (notifications.length === 0) {
    return <p className="px-1 text-center text-sm text-ink-faint">No notifications yet. Texts and letters from the bank appear here.</p>;
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="Recent notifications">
      {notifications.map((notification) => {
        const { label: channel_label, Icon } = CHANNEL_DISPLAY[notification.channel] ?? CHANNEL_DISPLAY.APP_PUSH;
        return (
          <li key={notification.notification_id} className="animate-slide-in rounded-2xl bg-surface px-3.5 py-2.5 text-left">
            <div className="flex items-center justify-between gap-3 text-xs text-ink-faint">
              <span className="flex items-center gap-1.5 font-semibold">
                <Icon className="size-3.5" aria-hidden />
                {channel_label}
              </span>
              <span className="tabular-nums">{formatClockTime(notification.created_at)}</span>
            </div>
            <p className="mt-0.5 text-sm leading-snug">{notification.body}</p>
            {notification.kind === "IDENTITY_CHECK" ? <p className="mt-0.5 text-xs font-medium text-ink-soft">{IDENTITY_STATUS_LABELS[notification.status]}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
