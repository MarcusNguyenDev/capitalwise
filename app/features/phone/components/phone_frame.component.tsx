import type { ReactNode } from "react";

import { joinClassNames } from "@/shared/ui/join_class_names.util";

const CLOCK_FORMATTER = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", hour12: false });

interface PhoneFrameProps {
  current_time_ms: number | null;
  /** The in-call screen is dark, so the status bar switches to light text. */
  is_dark_screen: boolean;
  /** Notification banners, drawn over whatever screen is showing. */
  banners: ReactNode;
  children: ReactNode;
}

/**
 * A handset on wide screens. On a real phone the page already is a phone, so
 * the bezel and fake status bar are dropped and the screen fills the viewport.
 */
export function PhoneFrame({ current_time_ms, is_dark_screen, banners, children }: PhoneFrameProps) {
  return (
    <div className="relative flex h-full w-full flex-col md:h-[820px] md:w-[400px] md:shrink-0 md:rounded-[3.4rem] md:bg-ink md:p-3 md:shadow-overlay">
      <div
        className={joinClassNames(
          "relative flex h-full flex-col overflow-hidden transition-colors md:rounded-[2.7rem]",
          is_dark_screen ? "bg-ink text-white" : "bg-white text-ink",
        )}
      >
        <div className="absolute left-1/2 top-2.5 z-30 hidden h-7 w-28 -translate-x-1/2 rounded-full bg-black md:block" aria-hidden />
        <div className="relative z-20 hidden items-center justify-between px-8 pb-1 pt-3.5 text-sm font-semibold md:flex" aria-hidden>
          <span>{current_time_ms === null ? "" : CLOCK_FORMATTER.format(current_time_ms)}</span>
          <span className="flex items-center gap-1.5">
            <span className="text-xs">5G</span>
            <span className="h-3 w-6 rounded-sm border border-current p-px">
              <span className="block h-full w-4/5 rounded-[1px] bg-current" />
            </span>
          </span>
        </div>
        <div className="absolute inset-x-3 top-3 z-40 flex flex-col gap-2 md:top-12" aria-live="assertive">
          {banners}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <div className="mx-auto mb-2 mt-1 hidden h-1.5 w-32 rounded-full bg-current opacity-70 md:block" aria-hidden />
      </div>
    </div>
  );
}
