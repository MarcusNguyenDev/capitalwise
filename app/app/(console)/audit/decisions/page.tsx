import { Suspense } from "react";

import { DecisionsWorkspace } from "@/features/audit/components/decisions_workspace.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";

export default function DecisionsPage() {
  return (
    <Suspense fallback={<SkeletonList label="Loading decisions" />}>
      <DecisionsWorkspace />
    </Suspense>
  );
}
