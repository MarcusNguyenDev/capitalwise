"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
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
import { CallerDetailsPanel } from "./caller_details_card.component";
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

  // The selected caller's own details, for whoever plays them to answer the
  // security questions. Reloaded when a call starts or ends (a new card, say).
  const caller_details_panel = <CallerDetailsPanel customer_id={selected_customer_id} refresh_key={phone_call.call_phase} />;

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
    <main className="relative isolate flex h-dvh flex-col bg-white md:h-auto md:min-h-dvh md:flex-row md:items-center md:justify-center md:gap-8 md:overflow-x-clip md:bg-brand-soft md:px-6 md:py-8 lg:gap-20">
      <Image
        src="/brand/westpac-background.svg"
        width={684}
        height={456}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-36 bottom-0 -z-10 hidden w-[44rem] max-w-none opacity-[0.07] md:block"
      />
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

      <aside aria-label="Demo controls" className="hidden w-72 shrink-0 flex-col md:flex lg:w-96">
        <div className="mb-10 flex items-center gap-5">
          {bank_name.trim().toLowerCase() === "westpac" ? (
            <Image src="/brand/westpac-logo.svg" width={69} height={28} alt="Westpac" className="h-7 w-auto" />
          ) : (
            <span className="text-xl font-bold text-brand-deep">{bank_name}</span>
          )}
          <span className="border-l border-brand-deep/20 py-1 pl-5 text-sm font-semibold text-brand-deep">CapitalWise</span>
        </div>
        <div className="mb-7">
          <div className="mb-4 flex items-center gap-3">
            <Image src="/brand/westpac-headset.svg" width={42} height={42} alt="" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-deep">Customer phone</p>
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-brand-deep lg:text-4xl">A little help.<br />A real conversation.</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft lg:text-base">
            Banking support that starts with a conversation. The AI specialist confirms who you are, helps with your request and brings in a person when you need one.
          </p>
          <p className="mt-3 text-sm font-semibold text-brand-deep">Any phone. No menus. No app needed.</p>
        </div>
        <section className="rounded-xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-4 border-b border-line pb-3 text-sm font-semibold text-brand-deep">Try a customer conversation</h2>
          {demo_controls}
        </section>
        <div className="mt-4 rounded-xl border border-line bg-white p-5 shadow-card xl:hidden">{caller_details_panel}</div>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">CapitalWise prototype · Mock customers and data</p>
      </aside>

      <div className="relative flex min-h-0 flex-1 md:flex-none">
        <PhoneFrame current_time_ms={current_time_ms} is_dark_screen={is_on_call} banners={banners}>
          {is_on_call ? (
            <PhoneCallScreen
              bank_name={bank_name}
              caller_customer_id={selected_caller?.customer_id ?? null}
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

      <aside aria-label="Caller's details" className="hidden w-72 shrink-0 rounded-lg border border-line bg-white p-4 shadow-card xl:block">
        {caller_details_panel}
      </aside>

      <Sheet is_open={is_demo_sheet_open} onOpenChange={setIsDemoSheetOpen} title="Demo settings" description="Not part of the customer's phone." side="right">
        <div className="flex flex-col gap-5 p-4">
          {demo_controls}
          <div className="rounded-lg border border-line bg-canvas p-3">{caller_details_panel}</div>
        </div>
      </Sheet>
    </main>
  );
}
