"use client";

import { useEffect, useState } from "react";

import { useDemoConfig } from "@/shared/demo/demo_config.provider";
import { useCurrentTime } from "@/shared/format/use_current_time.hook";
import { useLiveSocket } from "@/shared/live/live_socket.provider";
import type { CallMode } from "@/shared/types/call.type";
import { ErrorState } from "@/shared/ui/surface.component";

import { DEFAULT_CALLER_ID } from "../constants/hero_persona.constant";
import { useCallerDirectory } from "../hooks/use_caller_directory.hook";
import { usePhoneCall } from "../hooks/use_phone_call.hook";
import { usePhoneNotifications } from "../hooks/use_phone_notifications.hook";
import { CallModeSwitch } from "./call_mode_switch.component";
import { CallerSelector } from "./caller_selector.component";
import { NotificationHistory } from "./notification_history.component";
import { PhoneCallScreen } from "./phone_call_screen.component";
import { PhoneFrame } from "./phone_frame.component";
import { PhoneIdleScreen } from "./phone_idle_screen.component";
import { PhoneNotificationBanner } from "./phone_notification_banner.component";

function chooseCallMode(preferred_mode: CallMode, is_live_available: boolean, is_scripted_available: boolean): CallMode | null {
  const is_preferred_available = preferred_mode === "LIVE" ? is_live_available : is_scripted_available;
  if (is_preferred_available) {
    return preferred_mode;
  }
  if (is_scripted_available) {
    return "SCRIPTED";
  }
  return is_live_available ? "LIVE" : null;
}

/** The simulated customer mobile: caller ID, the call itself, and the bank's push and SMS notifications. */
export function CustomerPhone() {
  const [selected_customer_id, setSelectedCustomerId] = useState(DEFAULT_CALLER_ID);
  const [preferred_mode, setPreferredMode] = useState<CallMode>("SCRIPTED");
  const { bank_name } = useDemoConfig();
  const { joinRooms } = useLiveSocket();
  const current_time_ms = useCurrentTime();
  const caller_directory = useCallerDirectory();
  const hasScript = (customer_id: string) => caller_directory.scripted_customer_ids.includes(customer_id);
  const phone_call = usePhoneCall({ hasScript, onSwitchToScripted: () => setPreferredMode("SCRIPTED") });
  const phone_notifications = usePhoneNotifications(selected_customer_id);

  const selected_caller = caller_directory.callers.find((caller) => caller.customer_id === selected_customer_id) ?? null;
  const is_scripted_available = hasScript(selected_customer_id);
  const call_mode = chooseCallMode(preferred_mode, caller_directory.is_live_available, is_scripted_available);
  const is_on_call = phone_call.call_phase === "IN_CALL";
  const is_busy = phone_call.call_phase !== "IDLE";
  const call_seconds =
    current_time_ms !== null && phone_call.connected_at_ms !== null ? Math.max(0, Math.floor((current_time_ms - phone_call.connected_at_ms) / 1000)) : 0;

  useEffect(() => {
    joinRooms({ role: "PHONE", customer_id: selected_customer_id });
  }, [joinRooms, selected_customer_id]);

  const handleCall = () => {
    if (selected_caller && call_mode) {
      void phone_call.placeCall(selected_caller, call_mode);
    }
  };

  const banners = phone_notifications.banner_notifications.map((notification) => (
    <PhoneNotificationBanner
      key={notification.notification_id}
      notification={notification}
      bank_name={bank_name}
      onRespond={phone_notifications.respondToIdentityCheck}
      onDismiss={phone_notifications.dismissBanner}
    />
  ));

  return (
    <main className="flex min-h-screen flex-wrap items-center justify-center gap-x-16 gap-y-8 bg-surface px-8 py-8">
      <section className="flex w-[30rem] max-w-full flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer phone</h1>
          <p className="mt-1 text-lg text-ink-soft">
            The bank recognises the caller&apos;s number and confirms identity with a push to their banking app. Resolve, don&apos;t deflect.
          </p>
        </div>
        {caller_directory.error_message ? <ErrorState message={caller_directory.error_message} /> : null}
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-faint">Who is calling</h2>
          <CallerSelector
            callers={caller_directory.callers}
            selected_customer_id={selected_customer_id}
            is_disabled={is_busy}
            onSelect={setSelectedCustomerId}
          />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-faint">Call mode</h2>
          <CallModeSwitch
            call_mode={call_mode}
            is_live_available={caller_directory.is_live_available}
            live_unavailable_reason={caller_directory.live_unavailable_reason}
            is_scripted_available={is_scripted_available}
            is_disabled={is_busy}
            onChange={setPreferredMode}
          />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-faint">Notification history</h2>
          <div className="max-h-64 overflow-y-auto">
            <NotificationHistory notifications={phone_notifications.notifications} />
          </div>
        </div>
        <p className="text-sm text-ink-faint">Prototype, mock data only</p>
      </section>

      <PhoneFrame current_time_ms={current_time_ms} is_dark_screen={is_on_call} banners={banners}>
        {is_on_call ? (
          <PhoneCallScreen
            bank_name={bank_name}
            call={phone_call.active_call}
            call_mode={phone_call.call_mode}
            captions={phone_call.captions}
            human_staff_name={phone_call.human_staff_name}
            call_seconds={call_seconds}
            current_time_ms={current_time_ms}
            call_audio={phone_call.call_audio}
            onHangUp={phone_call.hangUp}
            onUnlockAudio={phone_call.unlockAudio}
            onMicrophoneMutedChange={phone_call.setMicrophoneMuted}
          />
        ) : (
          <PhoneIdleScreen
            caller={selected_caller}
            bank_name={bank_name}
            call_mode={call_mode}
            is_connecting={phone_call.call_phase === "CONNECTING"}
            has_just_ended={phone_call.call_phase === "ENDED"}
            onCall={handleCall}
          />
        )}
      </PhoneFrame>
    </main>
  );
}
