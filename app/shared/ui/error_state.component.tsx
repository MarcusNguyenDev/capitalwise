import { TriangleAlert } from "lucide-react";

import { Button } from "./button.component";
import { joinClassNames } from "./join_class_names.util";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

/** Something could not load. Says what happened in plain words and offers a retry. */
export function ErrorState({ title = "Could not load this", message, onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={joinClassNames("flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3", className)}>
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-soft">{message}</p>
      </div>
      {onRetry ? (
        <Button size="small" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
