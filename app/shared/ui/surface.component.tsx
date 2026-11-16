import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white p-6 ${className}`}>{children}</section>;
}

export function PageHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-4xl text-lg text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {description ? <p className="text-ink-soft">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <p className="text-lg font-semibold text-ink-soft">{title}</p>
      {description ? <p className="mt-1 text-ink-faint">{description}</p> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <p className="animate-pulse px-2 py-8 text-center text-ink-faint">{label}…</p>;
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-accent bg-accent-soft px-6 py-4 text-accent">
      {message}
    </div>
  );
}

/** A label with a value underneath, used in case packs and context panels. */
export function LabelledValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <div className="mt-0.5 text-base">{children}</div>
    </div>
  );
}
