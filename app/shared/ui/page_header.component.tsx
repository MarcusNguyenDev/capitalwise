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
    <header className="relative isolate flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-4 overflow-hidden bg-brand-deep px-5 py-6 text-white sm:px-7 sm:py-7">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-80 bg-[url('/brand/westpac-background.svg')] bg-cover bg-center opacity-[0.07]" />
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {meta}
        </div>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/85">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 rounded-md bg-white p-1 text-ink">{actions}</div> : null}
    </header>
  );
}
