"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

import { fetchApprovalInbox, resetDemo } from "@/shared/api_client/engine_api.client";
import { useDemoConfig } from "@/shared/demo/demo_config.provider";
import { formatCodeLabel } from "@/shared/format/format_values.util";
import { describeError } from "@/shared/http/service_request.error";
import { CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveSocket } from "@/shared/live/live_socket.provider";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";

import { Button } from "./button.component";
import { useToast } from "./toast.provider";

const NAVIGATION_LINKS = [
  { href: "/", label: "Live conversations" },
  { href: "/approvals", label: "Approvals" },
  { href: "/audit", label: "Audit & explainability" },
  { href: "/resources", label: "Resources" },
  { href: "/compare", label: "Before & after" },
] as const;

function StaffSwitcher() {
  const { staff_members, current_staff_id, selectStaff } = useCurrentStaff();

  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      Signed in as
      <select
        className="rounded-lg border border-line bg-white px-3 py-2 text-base font-semibold text-ink"
        value={current_staff_id}
        onChange={(change_event) => selectStaff(change_event.target.value)}
      >
        {staff_members.length === 0 ? <option value={current_staff_id}>Alex Chen · Team leader</option> : null}
        {staff_members.map((staff_member) => (
          <option key={staff_member.staff_id} value={staff_member.staff_id}>
            {staff_member.name} · {formatCodeLabel(staff_member.role)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ResetDemoButton() {
  const [is_resetting, setIsResetting] = useState(false);
  const { showToast } = useToast();

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetDemo();
      showToast({ title: "Demo reset", description: "The database was reseeded and the simulator stopped.", tone: "success" });
    } catch (error) {
      showToast({ title: "Reset failed", description: describeError(error), tone: "error" });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Button size="small" variant="ghost" disabled={is_resetting} onClick={handleReset}>
      {is_resetting ? "Resetting…" : "Reset demo"}
    </Button>
  );
}

function ConnectionIndicator() {
  const { is_connected } = useLiveSocket();
  return (
    <span className="flex items-center gap-1.5 text-sm text-ink-soft" title={is_connected ? "Live updates connected" : "Reconnecting to live updates"}>
      <span className={`h-2.5 w-2.5 rounded-full ${is_connected ? "bg-positive" : "animate-pulse bg-warning"}`} />
      {is_connected ? "Live" : "Reconnecting"}
    </span>
  );
}

/** Header, navigation and footer shared by every supervisor console page. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { bank_name, is_demo_mode } = useDemoConfig();
  const inbox_query = useLiveQuery(fetchApprovalInbox, CASE_EVENTS);
  const pending_case_count = inbox_query.data?.length ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="flex items-center gap-8 px-8 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-lg font-black text-white">
              {bank_name.charAt(0)}
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-bold">{bank_name}</span>
              <span className="block text-sm text-ink-soft">AI Specialist Console</span>
            </span>
          </Link>
          <nav className="flex flex-1 items-center gap-1">
            {NAVIGATION_LINKS.map((navigation_link) => {
              const is_current = pathname === navigation_link.href;
              return (
                <Link
                  key={navigation_link.href}
                  href={navigation_link.href}
                  aria-current={is_current ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 font-semibold transition-colors ${is_current ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-surface"}`}
                >
                  {navigation_link.label}
                  {navigation_link.href === "/approvals" && pending_case_count > 0 ? (
                    <span key={pending_case_count} className="animate-fade-in rounded-full bg-accent px-2 text-sm text-white">
                      {pending_case_count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <a href="/phone" target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 font-semibold text-ink-soft hover:bg-surface">
              Customer phone ↗
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <ConnectionIndicator />
            {is_demo_mode ? <ResetDemoButton /> : null}
            <StaffSwitcher />
          </div>
        </div>
      </header>
      <main className="flex-1 px-8 py-6">{children}</main>
      <footer className="flex items-center justify-between border-t border-line px-8 py-3 text-sm text-ink-faint">
        <span>The AI proposes, deterministic policy decides, humans oversee.</span>
        <span className="rounded-full border border-line px-3 py-0.5 font-semibold">Prototype, mock data only</span>
      </footer>
    </div>
  );
}
