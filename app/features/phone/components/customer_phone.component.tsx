"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { useDemoConfig } from "@/shared/demo/demo_config.provider";
import { useCurrentTime } from "@/shared/format/use_current_time.hook";
import { useLiveSocket } from "@/shared/live/live_socket.provider";
import type { CallMode } from "@/shared/types/call.type";
import { Sheet } from "@/shared/ui/sheet.component";

import { DEFAULT_CALLER_ID, findHeroPersona, isUnscriptedCaller } from "../constants/hero_persona.constant";
import { useCallerDirectory } from "../hooks/use_caller_directory.hook";
import { usePhoneCall } from "../hooks/use_phone_call.hook";
import { usePhoneNotifications } from "../hooks/use_phone_notifications.hook";
import { PhoneCallScreen } from "./phone_call_screen.component";
import { PhoneDemoControls } from "./phone_demo_controls.component";
import { PhoneFrame } from "./phone_frame.component";
import { PhoneIdleScreen } from "./phone_idle_screen.component";
import { PhoneNotificationBanner } from "./phone_notification_banner.component";

const CALL_MODE_LABELS: Record<CallMode, string> = { SCRIPTED: "Scripted", LIVE: "Live voice" };
const DEFAULT_LIVE_UNAVAILABLE_REASON = "The core service reports that live voice is unavailable.";

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

/**
 * The simulated customer mobile. On a desktop the demo controls sit beside
 * the handset; on a real phone the page is the phone, and the demo controls
 * live behind a small bar at the top.
 */
export function CustomerPhone() {
  const [selected_customer_id, setSelectedCustomerId] = useState(DEFAULT_CALLER_ID);
  const [preferred_mode, setPreferredMode] = useState<CallMode>("SCRIPTED");
  const [is_demo_sheet_open, setIsDemoSheetOpen] = useState(false);
  const { bank_name } = useDemoConfig();
  const { joinRooms } = useLiveSocket();
  const current_time_ms = useCurrentTime();
  const caller_directory = useCallerDirectory();
  const hasScript = (customer_id: string) => caller_directory.scripted_customer_ids.includes(customer_id);
  const phone_call = usePhoneCall({ hasScript, onSwitchToScripted: () => setPreferredMode("SCRIPTED") });
  const phone_notifications = usePhoneNotifications(selected_customer_id);

  const selected_caller = caller_directory.callers.find((caller) => caller.customer_id === selected_customer_id) ?? null;
  const selected_caller_label = findHeroPersona(selected_customer_id)?.title ?? selected_caller?.full_name ?? null;
  const is_scripted_available = hasScript(selected_customer_id);
  // The presenter's own story has no script: it is always Live, and stays selectable while Live is off.
  const call_mode = isUnscriptedCaller(selected_customer_id)
    ? "LIVE"
    : chooseCallMode(preferred_mode, caller_directory.is_live_available, is_scripted_available);
  const call_blocked_reason =
    call_mode === "LIVE" && !caller_directory.is_live_available ? (caller_directory.live_unavailable_reason ?? DEFAULT_LIVE_UNAVAILABLE_REASON) : null;
  const is_on_call = phone_call.call_phase === "IN_CALL";
  const is_busy = phone_call.call_phase !== "IDLE";
  const call_seconds =
    current_time_ms !== null && phone_call.connected_at_ms !== null ? Math.max(0, Math.floor((current_time_ms - phone_call.connected_at_ms) / 1000)) : 0;

  useEffect(() => {
    joinRooms({ role: "PHONE", customer_id: selected_customer_id });
  }, [joinRooms, selected_customer_id]);

  const handleCall = () => {
    if (selected_caller && call_mode && !call_blocked_reason) {
      void phone_call.placeCall(selected_caller, call_mode);
    }
  };

  const demo_controls = (
    <PhoneDemoControls
      callers={caller_directory.callers}
      selected_customer_id={selected_customer_id}
      call_mode={call_mode}
      is_live_available={caller_directory.is_live_available}
      live_unavailable_reason={caller_directory.live_unavailable_reason}
      is_scripted_available={is_scripted_available}
      is_in_call={is_busy}
      error_message={caller_directory.error_message}
      onSelectCaller={setSelectedCustomerId}
      onChangeMode={setPreferredMode}
    />
  );

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
    <main className="flex h-dvh flex-col bg-canvas md:flex-row md:items-center md:justify-center md:gap-12 md:overflow-y-auto md:px-8 md:py-8">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-white px-3 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setIsDemoSheetOpen(true)}
          className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-canvas"
          aria-label="Demo settings: change who is calling and the call mode"
        >
          <SlidersHorizontal className="size-4 shrink-0 text-ink-faint" aria-hidden />
          <span className="truncate">
            <span className="text-ink-faint">Demo · </span>
            <span className="font-semibold">{selected_caller_label ?? "Choose a caller"}</span>
            <span className="text-ink-faint"> · {call_mode ? CALL_MODE_LABELS[call_mode] : "No mode"}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-faint" aria-hidden />
        </button>
        <span className="shrink-0 text-xs text-ink-faint">Mock data</span>
      </div>

      <aside aria-label="Demo controls" className="hidden w-80 shrink-0 flex-col gap-4 md:flex">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Demo controls</p>
          <h1 className="mt-1 text-xl font-semibold">Customer phone</h1>
          <p className="mt-1 text-sm text-ink-soft">The bank recognises the caller&apos;s number and confirms who they are with a push to their banking app.</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">{demo_controls}</div>
        <p className="text-xs text-ink-faint">Prototype, mock data only</p>
      </aside>

      <div className="flex min-h-0 flex-1 md:flex-none">
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
              onSendTypedMessage={phone_call.sendTypedMessage}
              onHangUp={phone_call.hangUp}
              onUnlockAudio={phone_call.unlockAudio}
              onMicrophoneMutedChange={phone_call.setMicrophoneMuted}
            />
          ) : (
            <PhoneIdleScreen
              caller={selected_caller}
              bank_name={bank_name}
              call_mode={call_mode}
              call_blocked_reason={call_blocked_reason}
              notifications={phone_notifications.notifications}
              is_connecting={phone_call.call_phase === "CONNECTING"}
              has_just_ended={phone_call.call_phase === "ENDED"}
              onCall={handleCall}
            />
          )}
        </PhoneFrame>
      </div>

      <Sheet is_open={is_demo_sheet_open} onOpenChange={setIsDemoSheetOpen} title="Demo settings" description="Not part of the customer's phone." side="right">
        <div className="p-4">{demo_controls}</div>
      </Sheet>
    </main>
  );
}
