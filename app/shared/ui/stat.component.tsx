import { joinClassNames } from "./join_class_names.util";

interface StatProps {
  label: string;
  value: string;
  is_highlighted?: boolean;
}

/** One number with its label. The value flashes when it changes. */
export function Stat({ label, value, is_highlighted = false }: StatProps) {
  return (
    <div className="min-w-0 border-l-2 border-line pl-3 first:border-brand-deep">
      <dt className="text-xs font-medium leading-snug text-ink-faint">{label}</dt>
      <dd key={value} className={joinClassNames("mt-1 inline-block rounded text-2xl font-bold tracking-tight tabular-nums", value !== "–" && "animate-highlight", is_highlighted ? "text-warning" : "text-brand-deep")}>
        {value}
      </dd>
    </div>
  );
}
