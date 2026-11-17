import { CirclePlay, ScrollText } from "lucide-react";
import Link from "next/link";

/** Where to go next once a call is over. */
export function CallEndedFooter({ call_id }: { call_id: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line bg-canvas px-5 py-3 text-sm">
      <span className="text-ink-soft">The call has ended.</span>
      <Link href={`/audit/replay?call=${call_id}`} className="inline-flex items-center gap-1.5 font-semibold text-info hover:underline">
        <CirclePlay className="size-4" aria-hidden />
        Replay it
      </Link>
      <Link href={`/audit?call=${call_id}`} className="inline-flex items-center gap-1.5 font-semibold text-info hover:underline">
        <ScrollText className="size-4" aria-hidden />
        Audit trail
      </Link>
    </div>
  );
}
