import { BadgeCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

import type { LiveCall } from "@/shared/types/call.type";
import { Badge } from "@/shared/ui/badge.component";

import { describeCallIdentity } from "./describe_call_identity.util";
import { CALL_IDENTITY_LABELS, CALL_IDENTITY_TONES } from "./status_wording.constant";
import type { CallIdentityState } from "./status_wording.constant";

const ICON_CLASS_NAME = "size-3.5";

function IdentityIcon({ identity_state }: { identity_state: CallIdentityState }) {
  if (identity_state === "LOCKED") {
    return <ShieldAlert className={ICON_CLASS_NAME} aria-hidden />;
  }
  return identity_state === "NOT_CONFIRMED" ? <ShieldQuestion className={ICON_CLASS_NAME} aria-hidden /> : <BadgeCheck className={ICON_CLASS_NAME} aria-hidden />;
}

/** "Confirmed by questions, level 2", "Locked after failed checks" (danger), or "Identity not yet confirmed". */
export function CallIdentityBadge({ call }: { call: Pick<LiveCall, "identity_verified"> & Partial<Pick<LiveCall, "identity_level" | "identity_method" | "is_identity_locked">> }) {
  const identity_state = describeCallIdentity(call);
  return (
    <Badge key={identity_state} tone={CALL_IDENTITY_TONES[identity_state]} icon={<IdentityIcon identity_state={identity_state} />} className="animate-highlight">
      {CALL_IDENTITY_LABELS[identity_state]}
    </Badge>
  );
}
