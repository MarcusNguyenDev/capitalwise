import type { ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  body_class_name?: string;
  children: ReactNode;
}

/** A white panel on the canvas. Title, description and actions are optional. */
export function Card({ title, description, actions, className, body_class_name, children }: CardProps) {
  const has_header = Boolean(title || description || actions);
  return (
    <section className={joinClassNames("rounded-lg border border-line bg-white shadow-card", className)}>
      {has_header ? (
        <header className="flex items-start justify-between gap-4 px-5 pt-4">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-ink-soft">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={joinClassNames("px-5 pb-5", has_header ? "pt-3" : "pt-5", body_class_name)}>{children}</div>
    </section>
  );
}
