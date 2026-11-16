import type { ReactNode } from "react";

import { CurrentStaffProvider } from "@/shared/staff/current_staff.provider";
import { AppShell } from "@/shared/ui/app_shell.component";

/** Staff-facing pages share the console shell; the customer phone does not. */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <CurrentStaffProvider>
      <AppShell>{children}</AppShell>
    </CurrentStaffProvider>
  );
}
