import { Suspense } from "react";

import { AuditLogWorkspace } from "@/features/audit/components/audit_log_workspace.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";

export default function AuditLogPage() {
  return (
    <Suspense fallback={<SkeletonList label="Loading the audit log" />}>
      <AuditLogWorkspace />
    </Suspense>
  );
}
