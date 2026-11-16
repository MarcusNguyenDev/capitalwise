import type { CallMode } from "@/shared/types/call.type";
import type { Caller } from "@/shared/types/resources.type";

import { formatMobileNumber } from "../format_mobile_number.util";
import { PhoneIcon } from "./phone_icon.component";

interface PhoneIdleScreenProps {
  caller: Caller | null;
  bank_name: string;
  call_mode: CallMode | null;
  is_connecting: boolean;
  has_just_ended: boolean;
  onCall: () => void;
}

/** The dialler: who this phone belongs to and one big Call button. No menus to navigate. */
export function PhoneIdleScreen({ caller, bank_name, call_mode, is_connecting, has_just_ended, onCall }: PhoneIdleScreenProps) {
  const can_call = caller !== null && call_mode !== null && !is_connecting && !has_just_ended;

  return (
    <div className="flex flex-1 flex-col items-center px-8 pb-8 pt-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-faint">{caller ? `${caller.first_name}'s phone` : "Customer phone"}</p>
      <p className="mt-1 text-ink-soft">{caller ? formatMobileNumber(caller.mobile_phone) : "Choose who is calling"}</p>

      <div className="mt-16 flex h-24 w-24 items-center justify-center rounded-3xl bg-accent text-5xl font-black text-white shadow-lg">
        {bank_name.charAt(0)}
      </div>
      <p className="mt-5 text-2xl font-bold">{bank_name}</p>
      <p className="mt-1 text-lg text-ink-soft">24/7 phone banking</p>

      <div className="mt-auto flex flex-col items-center gap-4">
        {has_just_ended ? <p className="animate-fade-in text-xl font-semibold text-ink-soft">Call ended</p> : null}
        {is_connecting ? <p className="animate-pulse text-xl font-semibold text-ink-soft">Calling…</p> : null}
        <button
          type="button"
          disabled={!can_call}
          onClick={onCall}
          aria-label={`Call ${bank_name}`}
          className={`flex h-20 w-20 items-center justify-center rounded-full bg-positive text-white shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 ${is_connecting ? "animate-ring" : ""}`}
        >
          <PhoneIcon />
        </button>
        <p className="text-ink-soft">{call_mode === null ? "No call mode available" : `Call ${bank_name}`}</p>
        <p className="text-sm text-ink-faint">No menus. No account number. No passkey.</p>
      </div>
    </div>
  );
}
