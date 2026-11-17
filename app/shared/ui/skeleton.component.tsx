import { joinClassNames } from "./join_class_names.util";

/** A grey placeholder in the shape of content that is still loading. */
export function Skeleton({ className }: { className?: string }) {
  return <span className={joinClassNames("block animate-pulse rounded-md bg-surface", className)} aria-hidden />;
}

/** A stack of list-row placeholders, announced once to screen readers. */
export function SkeletonList({ row_count = 5, label = "Loading" }: { row_count?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2 p-3">
      {Array.from({ length: row_count }, (_, row_index) => (
        <div key={row_index} className="flex flex-col gap-2 rounded-lg border border-line bg-white p-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a detail pane: a heading and a few blocks. */
export function SkeletonDetail({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-4 p-6">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
