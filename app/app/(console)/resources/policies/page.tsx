import { Suspense } from "react";

import { PoliciesWorkspace } from "@/features/resources/components/policies_workspace.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";

export default function PoliciesPage() {
  return (
    <Suspense fallback={<SkeletonList label="Loading policies" />}>
      <PoliciesWorkspace />
    </Suspense>
  );
}
