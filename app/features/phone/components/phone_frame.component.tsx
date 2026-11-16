import type { ReactNode } from "react";

const CLOCK_FORMATTER = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", hour12: false });

interface PhoneFrameProps {
  current_time_ms: number | null;
  /** The in-call screen is dark, so the status bar switches to light text. */
  is_dark_screen: boolean;
  /** Notification banners, drawn over whatever screen is showing. */
  banners: ReactNode;
  children: ReactNode;
}

/** The handset: bezel, status bar and a screen area for the current screen. */
export function PhoneFrame({ current_time_ms, is_dark_screen, banners, children }: PhoneFrameProps) {
  return (
    <div className="relative h-[820px] w-[400px] shrink-0 rounded-[3.4rem] bg-ink p-3 shadow-2xl ring-1 ring-black/20">
      <div className={`relative flex h-full flex-col overflow-hidden rounded-[2.7rem] transition-colors ${is_dark_screen ? "bg-ink text-white" : "bg-white text-ink"}`}>
        <div className="absolute left-1/2 top-2.5 z-30 h-7 w-28 -translate-x-1/2 rounded-full bg-black" aria-hidden />
        <div className="relative z-20 flex items-center justify-between px-8 pb-1 pt-3.5 text-sm font-semibold">
          <span>{current_time_ms === null ? "" : CLOCK_FORMATTER.format(current_time_ms)}</span>
          <span className="flex items-center gap-1.5" aria-hidden>
            <span className="text-xs">5G</span>
            <span className="h-3 w-6 rounded-sm border border-current p-px">
              <span className="block h-full w-4/5 rounded-[1px] bg-current" />
            </span>
          </span>
        </div>
        <div className="absolute inset-x-3 top-12 z-40 flex flex-col gap-2">{banners}</div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <div className="mx-auto mb-2 mt-1 h-1.5 w-32 rounded-full bg-current opacity-70" aria-hidden />
      </div>
    </div>
  );
}
