import { Suspense } from "react";

import { LiveCallsWorkspace } from "@/features/live_calls/components/live_calls_workspace.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";

export default function LiveCallsPage() {
  return (
    <Suspense fallback={<SkeletonList label="Loading live calls" />}>
      <LiveCallsWorkspace />
    </Suspense>
  );
}
