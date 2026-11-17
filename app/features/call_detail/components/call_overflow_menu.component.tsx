"use client";

import { Ellipsis, Link2, PhoneOff, ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { LiveCall } from "@/shared/types/call.type";
import { ConfirmDialog } from "@/shared/ui/confirm_dialog.component";
import { DropdownMenu, MenuItem, MenuSeparator } from "@/shared/ui/dropdown_menu.component";
import { IconButton } from "@/shared/ui/icon_button.component";
import { useToast } from "@/shared/ui/toast.provider";

interface CallOverflowMenuProps {
  call: LiveCall;
  is_busy: boolean;
  onEndCall: () => Promise<boolean>;
}

/** Less frequent actions, including the destructive one, kept one step away from the primary action. */
export function CallOverflowMenu({ call, is_busy, onEndCall }: CallOverflowMenuProps) {
  const [is_end_confirm_open, setIsEndConfirmOpen] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const is_ended = call.status === "ENDED";

  const copyCallLink = () => {
    void navigator.clipboard
      ?.writeText(`${window.location.origin}/?call=${call.call_id}`)
      .then(() => showToast({ title: "Link to this call copied", tone: "success" }))
      .catch(() => undefined);
  };

  const confirmEndCall = async () => {
    if (await onEndCall()) {
      setIsEndConfirmOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu trigger={<IconButton label="More actions" icon={<Ellipsis className="size-4" aria-hidden />} />}>
        <MenuItem icon={<ScrollText />} onSelect={() => router.push(`/audit?call=${call.call_id}`)}>
          Open the audit trail
        </MenuItem>
        <MenuItem icon={<Link2 />} onSelect={copyCallLink}>
          Copy link to this call
        </MenuItem>
        {is_ended ? null : (
          <>
            <MenuSeparator />
            <MenuItem icon={<PhoneOff />} is_destructive onSelect={() => setIsEndConfirmOpen(true)}>
              End call…
            </MenuItem>
          </>
        )}
      </DropdownMenu>
      <ConfirmDialog
        is_open={is_end_confirm_open}
        onOpenChange={setIsEndConfirmOpen}
        title={`End the call with ${call.customer_name ?? "this caller"}?`}
        description="The customer is disconnected straight away. Anything still pending stays in the approval queue."
        confirm_label="End call"
        is_destructive
        is_busy={is_busy}
        onConfirm={() => void confirmEndCall()}
      />
    </>
  );
}
