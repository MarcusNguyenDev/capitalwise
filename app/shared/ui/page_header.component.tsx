import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  /** One short line. Longer explanations belong behind a help link or in empty states. */
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, meta, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line bg-white px-6 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {meta}
        </div>
        {description ? <p className="mt-0.5 text-sm text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
