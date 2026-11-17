"use client";

import { Command } from "cmdk";
import { ClipboardCheck, FileSearch, Headphones, Keyboard, RotateCcw, Search, Smartphone, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useDemoConfig } from "@/shared/demo/demo_config.provider";
import { formatCodeLabel } from "@/shared/format/format_values.util";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import { CALL_STATUS_LABELS, CASE_STATUS_LABELS } from "@/shared/status/status_wording.constant";

import { CUSTOMER_PHONE_PATH, NAVIGATION_SECTIONS } from "../constants/navigation.constant";
import { useCommandPaletteData } from "../hooks/use_command_palette_data.hook";

interface CommandPaletteProps {
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  onOpenShortcuts: () => void;
  onResetDemo: () => void;
}

const GROUP_CLASS_NAME =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-faint";

function PaletteItem({ value, keywords, icon, detail, onSelect, children }: { value: string; keywords?: string[]; icon: ReactNode; detail?: string; onSelect: () => void; children: ReactNode }) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className="mx-1.5 flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm data-[selected=true]:bg-surface"
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-ink-faint [&>svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {detail ? <span className="shrink-0 text-xs text-ink-faint">{detail}</span> : null}
    </Command.Item>
  );
}

function PaletteResults({ onClose, onOpenShortcuts, onResetDemo }: { onClose: () => void; onOpenShortcuts: () => void; onResetDemo: () => void }) {
  const router = useRouter();
  const palette_data = useCommandPaletteData();
  const { staff_members, current_staff_id, selectStaff } = useCurrentStaff();
  const { is_demo_mode } = useDemoConfig();

  const goTo = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <Command.List className="max-h-[min(60vh,28rem)] overflow-y-auto pb-2">
      <Command.Empty className="px-4 py-8 text-center text-sm text-ink-soft">
        {palette_data.is_loading ? "Loading…" : "Nothing matches. Try a customer name or a case number."}
      </Command.Empty>
      {palette_data.live_calls.length > 0 ? (
        <Command.Group heading="Live calls" className={GROUP_CLASS_NAME}>
          {palette_data.live_calls.map((call) => (
            <PaletteItem
              key={call.call_id}
              value={`call ${call.call_id}`}
              keywords={[call.customer_name ?? "", call.intent ?? "", CALL_STATUS_LABELS[call.status]]}
              icon={<Headphones />}
              detail={CALL_STATUS_LABELS[call.status]}
              onSelect={() => goTo(`/?call=${call.call_id}`)}
            >
              {call.customer_name ?? "Unknown caller"} <span className="text-ink-faint">· {call.intent ?? "Intent not known yet"}</span>
            </PaletteItem>
          ))}
        </Command.Group>
      ) : null}
      {palette_data.pending_cases.length > 0 ? (
        <Command.Group heading="Waiting for approval" className={GROUP_CLASS_NAME}>
          {palette_data.pending_cases.map((pending_case) => (
            <PaletteItem
              key={pending_case.case_number}
              value={`pending ${pending_case.case_number}`}
              keywords={[pending_case.customer_name, formatCodeLabel(pending_case.action_code), pending_case.case_number]}
              icon={<ClipboardCheck />}
              detail={pending_case.case_number}
              onSelect={() => goTo(`/approvals?case=${pending_case.case_number}`)}
            >
              {pending_case.customer_name} <span className="text-ink-faint">· {formatCodeLabel(pending_case.action_code)}</span>
            </PaletteItem>
          ))}
        </Command.Group>
      ) : null}
      <Command.Group heading="Pages" className={GROUP_CLASS_NAME}>
        {NAVIGATION_SECTIONS.flatMap((navigation_section) => navigation_section.links).map((navigation_link) => {
          const Icon = navigation_link.icon;
          return (
            <PaletteItem
              key={navigation_link.href}
              value={`page ${navigation_link.label}`}
              keywords={[navigation_link.description]}
              icon={<Icon />}
              detail={navigation_link.description}
              onSelect={() => goTo(navigation_link.href)}
            >
              {navigation_link.label}
            </PaletteItem>
          );
        })}
      </Command.Group>
      {palette_data.decided_cases.length > 0 ? (
        <Command.Group heading="Recent decisions" className={GROUP_CLASS_NAME}>
          {palette_data.decided_cases.map((decided_case) => (
            <PaletteItem
              key={decided_case.case_number}
              value={`case ${decided_case.case_number}`}
              keywords={[decided_case.customer_name, formatCodeLabel(decided_case.action_code), decided_case.case_number]}
              icon={<FileSearch />}
              detail={CASE_STATUS_LABELS[decided_case.status]}
              onSelect={() => goTo(`/audit/decisions?case=${decided_case.case_number}`)}
            >
              {decided_case.customer_name} <span className="text-ink-faint">· {formatCodeLabel(decided_case.action_code)}</span>
            </PaletteItem>
          ))}
        </Command.Group>
      ) : null}
      {palette_data.callers.length > 0 ? (
        <Command.Group heading="Customers" className={GROUP_CLASS_NAME}>
          {palette_data.callers.map((caller) => (
            <PaletteItem
              key={caller.customer_id}
              value={`customer ${caller.customer_id}`}
              keywords={[caller.full_name, caller.customer_id]}
              icon={<UserRound />}
              detail="Show their decisions"
              onSelect={() => goTo(`/audit/decisions?q=${encodeURIComponent(caller.full_name)}`)}
            >
              {caller.full_name}
            </PaletteItem>
          ))}
        </Command.Group>
      ) : null}
      <Command.Group heading="Actions" className={GROUP_CLASS_NAME}>
        {staff_members
          .filter((staff_member) => staff_member.staff_id !== current_staff_id)
          .map((staff_member) => (
            <PaletteItem
              key={staff_member.staff_id}
              value={`act as ${staff_member.name}`}
              icon={<UserRound />}
              detail={formatCodeLabel(staff_member.role)}
              onSelect={() => {
                selectStaff(staff_member.staff_id);
                onClose();
              }}
            >
              Act as {staff_member.name}
            </PaletteItem>
          ))}
        <PaletteItem value="open customer phone" icon={<Smartphone />} onSelect={() => { onClose(); window.open(CUSTOMER_PHONE_PATH, "_blank", "noopener"); }}>
          Open the customer phone
        </PaletteItem>
        <PaletteItem value="keyboard shortcuts" icon={<Keyboard />} onSelect={() => { onClose(); onOpenShortcuts(); }}>
          Keyboard shortcuts
        </PaletteItem>
        {is_demo_mode ? (
          <PaletteItem value="reset demo data" icon={<RotateCcw />} onSelect={() => { onClose(); onResetDemo(); }}>
            Reset demo data…
          </PaletteItem>
        ) : null}
      </Command.Group>
    </Command.List>
  );
}

/** Cmd+K: find a call, case or customer by name, or jump to any page. */
export function CommandPalette({ is_open, onOpenChange, onOpenShortcuts, onResetDemo }: CommandPaletteProps) {
  return (
    <Command.Dialog
      open={is_open}
      onOpenChange={onOpenChange}
      label="Search or jump to"
      overlayClassName="fixed inset-0 z-50 animate-fade-in bg-ink/40"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 animate-fade-in overflow-hidden rounded-xl bg-white shadow-overlay"
    >
      <div className="flex items-center gap-2 border-b border-line px-4">
        <Search className="size-4 text-ink-faint" aria-hidden />
        <Command.Input placeholder="Search calls, cases, customers or pages…" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint focus-visible:outline-none" />
      </div>
      {is_open ? <PaletteResults onClose={() => onOpenChange(false)} onOpenShortcuts={onOpenShortcuts} onResetDemo={onResetDemo} /> : null}
    </Command.Dialog>
  );
}
