import { Suspense } from "react";

import { PromptsWorkspace } from "@/features/resources/components/prompts_workspace.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";

export default function PromptVersionsPage() {
  return (
    <Suspense fallback={<SkeletonList label="Loading prompt versions" />}>
      <PromptsWorkspace />
    </Suspense>
  );
}
