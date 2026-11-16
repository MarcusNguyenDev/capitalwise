"use client";

import { useEffect, useState } from "react";

import { fetchNotifications, respondToNotification } from "@/shared/api_client/engine_api.client";
import { describeError } from "@/shared/http/service_request.error";
import { LIVE_EVENT, NOTIFICATION_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveEvent } from "@/shared/live/use_live_event.hook";
import type { CustomerNotification } from "@/shared/types/case.type";
import { useToast } from "@/shared/ui/toast.provider";

import { NOTIFICATION_HISTORY_LIMIT, SMS_BANNER_VISIBLE_MS } from "../constants/phone_call.constant";

function upsertNotification(notifications: CustomerNotification[], notification: CustomerNotification): CustomerNotification[] {
  const is_known = notifications.some((known_notification) => known_notification.notification_id === notification.notification_id);
  return is_known
    ? notifications.map((known_notification) => (known_notification.notification_id === notification.notification_id ? notification : known_notification))
    : [notification, ...notifications];
}

function isAwaitingResponse(notification: CustomerNotification): boolean {
  return notification.kind === "IDENTITY_CHECK" && notification.status === "SENT";
}

export interface PhoneNotifications {
  notifications: CustomerNotification[];
  banner_notifications: CustomerNotification[];
  respondToIdentityCheck: (notification_id: string, response: "APPROVED" | "DENIED") => void;
  dismissBanner: (notification_id: string) => void;
}

/** Push and SMS notifications for the customer whose phone this is. Newest first. */
export function usePhoneNotifications(customer_id: string | null): PhoneNotifications {
  const [loaded_notifications, setLoadedNotifications] = useState<{ customer_id: string; notifications: CustomerNotification[] } | null>(null);
  const [banner_ids, setBannerIds] = useState<string[]>([]);
  const { showToast } = useToast();

  const notifications = loaded_notifications && loaded_notifications.customer_id === customer_id ? loaded_notifications.notifications : [];

  const dismissBanner = (notification_id: string) => {
    setBannerIds((current_ids) => current_ids.filter((banner_id) => banner_id !== notification_id));
  };

  useEffect(() => {
    if (!customer_id) {
      return;
    }
    let is_cancelled = false;
    fetchNotifications({ customer_id, limit: NOTIFICATION_HISTORY_LIMIT })
      .then((fetched_notifications) => {
        if (is_cancelled) {
          return;
        }
        setLoadedNotifications({ customer_id, notifications: fetched_notifications });
        setBannerIds(fetched_notifications.filter(isAwaitingResponse).map((notification) => notification.notification_id));
      })
      .catch(() => undefined);
    return () => {
      is_cancelled = true;
    };
  }, [customer_id]);

  useLiveEvent<CustomerNotification>(NOTIFICATION_EVENTS, (notification, event_name) => {
    if (!customer_id || notification.customer_id !== customer_id) {
      return;
    }
    setLoadedNotifications((current) => ({
      customer_id,
      notifications: upsertNotification(current?.customer_id === customer_id ? current.notifications : [], notification),
    }));
    if (event_name === LIVE_EVENT.NOTIFICATION_CREATED) {
      setBannerIds((current_ids) => [notification.notification_id, ...current_ids.filter((banner_id) => banner_id !== notification.notification_id)]);
      if (notification.kind !== "IDENTITY_CHECK") {
        setTimeout(() => dismissBanner(notification.notification_id), SMS_BANNER_VISIBLE_MS);
      }
    } else if (notification.kind === "IDENTITY_CHECK" && notification.status !== "SENT") {
      dismissBanner(notification.notification_id);
    }
  });

  useLiveEvent(LIVE_EVENT.DEMO_RESET, () => {
    setLoadedNotifications(null);
    setBannerIds([]);
  });

  const respondToIdentityCheck = (notification_id: string, response: "APPROVED" | "DENIED") => {
    dismissBanner(notification_id);
    respondToNotification(notification_id, response).catch((error) => {
      showToast({ title: "Could not send your response", description: describeError(error), tone: "error" });
    });
  };

  return {
    notifications,
    banner_notifications: notifications.filter(
      (notification) => banner_ids.includes(notification.notification_id) && (notification.kind !== "IDENTITY_CHECK" || isAwaitingResponse(notification)),
    ),
    respondToIdentityCheck,
    dismissBanner,
  };
}
