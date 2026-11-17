import { HeartHandshake } from "lucide-react";

import { Badge } from "@/shared/ui/badge.component";

/** The customer needs extra care: speak slowly, check understanding, involve a specialist. */
export function CareFlagBadge() {
  return (
    <Badge tone="attention" icon={<HeartHandshake className="size-3.5" aria-hidden />}>
      Care flag
    </Badge>
  );
}
