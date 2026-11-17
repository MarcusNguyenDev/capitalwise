import type { ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Says what would appear here, and when possible offers the one action that makes it appear. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={joinClassNames("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      {icon ? <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-deep [&>svg]:size-5">{icon}</div> : null}
      <p className="font-semibold text-brand-deep">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
