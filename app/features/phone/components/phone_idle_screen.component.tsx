import { Phone } from "lucide-react";

import type { CustomerNotification } from "@/shared/types/case.type";
import type { CallMode } from "@/shared/types/call.type";
import type { Caller } from "@/shared/types/resources.type";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

import { formatMobileNumber } from "../format_mobile_number.util";
import { NotificationHistory } from "./notification_history.component";

interface PhoneIdleScreenProps {
  caller: Caller | null;
  bank_name: string;
  call_mode: CallMode | null;
  /** Why the call cannot be placed right now, in `core`'s words (Live is off). */
  call_blocked_reason: string | null;
  notifications: CustomerNotification[];
  is_connecting: boolean;
  has_just_ended: boolean;
  onCall: () => void;
}

function describeCallState(props: Pick<PhoneIdleScreenProps, "call_mode" | "is_connecting" | "has_just_ended" | "bank_name">): string {
  if (props.has_just_ended) {
    return "Call ended";
  }
  if (props.is_connecting) {
    return "Calling…";
  }
  return props.call_mode === null ? "No call mode available" : `Call ${props.bank_name}`;
}

/** The phone at rest: whose phone it is, the bank's notifications, and one big Call button. No menus. */
export function PhoneIdleScreen({ caller, bank_name, call_mode, call_blocked_reason, notifications, is_connecting, has_just_ended, onCall }: PhoneIdleScreenProps) {
  const can_call = caller !== null && call_mode !== null && call_blocked_reason === null && !is_connecting && !has_just_ended;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center px-5 pb-6 pt-6 text-center md:pt-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">{caller ? `${caller.first_name}'s phone` : "Customer phone"}</p>
      <p className="mt-0.5 text-sm text-ink-soft">{caller ? formatMobileNumber(caller.mobile_phone) : "Choose who is calling"}</p>

      <div className="mt-6 flex size-16 items-center justify-center rounded-2xl bg-accent text-3xl font-black text-white shadow-raised" aria-hidden>
        {bank_name.charAt(0)}
      </div>
      <p className="mt-3 text-lg font-semibold">{bank_name}</p>
      <p className="text-sm text-ink-soft">24/7 phone banking</p>

      <div className="mt-5 min-h-0 w-full flex-1 overflow-y-auto">
        <NotificationHistory notifications={notifications} />
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <button
          type="button"
          disabled={!can_call}
          onClick={onCall}
          aria-label={`Call ${bank_name}`}
          className={joinClassNames(
            "flex size-[4.5rem] items-center justify-center rounded-full bg-positive text-white shadow-raised transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40",
            is_connecting && "animate-ring",
          )}
        >
          <Phone className="size-8" fill="currentColor" aria-hidden />
        </button>
        <p className="text-sm font-medium" role="status">
          {describeCallState({ call_mode, is_connecting, has_just_ended, bank_name })}
        </p>
        {call_blocked_reason ? (
          <p className="max-w-64 text-xs text-warning">Live voice is off, so this call cannot be placed: {call_blocked_reason}</p>
        ) : (
          <p className="text-xs text-ink-faint">No menus. No account number. No passkey.</p>
        )}
      </div>
    </div>
  );
}
