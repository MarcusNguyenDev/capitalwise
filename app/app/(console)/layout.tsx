import type { ReactNode } from "react";

import { ConsoleShell } from "@/features/console_shell/components/console_shell.component";
import { CurrentStaffProvider } from "@/shared/staff/current_staff.provider";

/** Staff-facing pages share the console shell; the customer phone does not. */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <CurrentStaffProvider>
      <ConsoleShell>{children}</ConsoleShell>
    </CurrentStaffProvider>
  );
}
