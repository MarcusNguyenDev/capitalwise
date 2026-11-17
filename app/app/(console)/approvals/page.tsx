import { Suspense } from "react";

import { ApprovalsWorkspace } from "@/features/approvals/components/approvals_workspace.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<SkeletonList label="Loading approvals" />}>
      <ApprovalsWorkspace />
    </Suspense>
  );
}
