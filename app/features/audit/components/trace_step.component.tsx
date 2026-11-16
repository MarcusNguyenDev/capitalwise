import type { ReactNode } from "react";

interface TraceStepProps {
  step_number: number;
  title: string;
  description?: string;
  is_last?: boolean;
  children: ReactNode;
}

/** One numbered step on the vertical decision trace. */
export function TraceStep({ step_number, title, description, is_last = false, children }: TraceStepProps) {
  return (
    <li className="grid animate-slide-in grid-cols-[3rem_1fr] gap-4" style={{ animationDelay: `${step_number * 60}ms` }}>
      <div className="flex flex-col items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-bold text-white">{step_number}</span>
        {is_last ? null : <span className="mt-1 w-0.5 flex-1 bg-line" />}
      </div>
      <div className="pb-8">
        <h3 className="text-xl font-bold leading-10">{title}</h3>
        {description ? <p className="-mt-1 mb-3 text-ink-soft">{description}</p> : null}
        {children}
      </div>
    </li>
  );
}
