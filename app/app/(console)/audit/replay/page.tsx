import { Suspense } from "react";

import { CallReplayWorkspace } from "@/features/audit/components/call_replay_workspace.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";

export default function CallReplayPage() {
  return (
    <Suspense fallback={<SkeletonList label="Loading ended calls" />}>
      <CallReplayWorkspace />
    </Suspense>
  );
}
