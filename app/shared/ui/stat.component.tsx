import { joinClassNames } from "./join_class_names.util";

interface StatProps {
  label: string;
  value: string;
  is_highlighted?: boolean;
}

/** One number with its label. The value flashes when it changes. */
export function Stat({ label, value, is_highlighted = false }: StatProps) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs font-medium text-ink-faint">{label}</dt>
      <dd key={value} className={joinClassNames("mt-0.5 inline-block animate-highlight rounded px-0.5 text-lg font-semibold tabular-nums", is_highlighted && "text-warning")}>
        {value}
      </dd>
    </div>
  );
}
