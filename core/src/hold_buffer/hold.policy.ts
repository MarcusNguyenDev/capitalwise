import { CallHoldReason } from '../calls/types/call_metrics.type';
import { HOLD_PHRASES } from './constants/hold_phrases.constant';
import { findHoldReason } from './constants/tool_hold_classes.constant';

export const MAX_HOLD_REMINDERS = 3;
export const FULL_ACKNOWLEDGEMENT_COOLDOWN_MS = 30_000;

export interface HoldPolicySettings {
  reminder_interval_ms: number;
  return_threshold_ms: number;
}

// Which hold line to say when, for one call. Pure apart from the clock, so
// it is easy to test: the voice agent does the playing.
export class HoldPolicy {
  private last_full_acknowledgement_at_ms: number | null = null;
  private next_short_variant_index = 0;

  constructor(
    private readonly settings: HoldPolicySettings,
    private readonly readNowMs: () => number = Date.now,
  ) {}

  get reminder_interval_ms(): number {
    return this.settings.reminder_interval_ms;
  }

  findHoldReason(tool_names: string[]): CallHoldReason | null {
    return findHoldReason(tool_names);
  }

  // The full "placing you on hold" line, or a shorter rotating variant when
  // the full one was heard in the last 30 seconds.
  chooseAcknowledgement(hold_reason: CallHoldReason): string {
    if (hold_reason === 'WAITING_FOR_APP_APPROVAL') {
      return HOLD_PHRASES.APP_APPROVAL_ACKNOWLEDGEMENT;
    }
    const now_ms = this.readNowMs();
    const is_full_line_recent =
      this.last_full_acknowledgement_at_ms !== null &&
      now_ms - this.last_full_acknowledgement_at_ms <
        FULL_ACKNOWLEDGEMENT_COOLDOWN_MS;
    if (!is_full_line_recent) {
      this.last_full_acknowledgement_at_ms = now_ms;
      return HOLD_PHRASES.CHECKING_SYSTEM_ACKNOWLEDGEMENT;
    }
    const short_variants = HOLD_PHRASES.CHECKING_SYSTEM_SHORT_ACKNOWLEDGEMENTS;
    const short_variant =
      short_variants[this.next_short_variant_index % short_variants.length];
    this.next_short_variant_index += 1;
    return short_variant;
  }

  // Null once the maximum number of reminders has been played.
  chooseReminder(
    hold_reason: CallHoldReason,
    reminders_played: number,
  ): string | null {
    if (reminders_played >= MAX_HOLD_REMINDERS) {
      return null;
    }
    return hold_reason === 'WAITING_FOR_APP_APPROVAL'
      ? HOLD_PHRASES.APP_APPROVAL_REMINDER
      : HOLD_PHRASES.CHECKING_SYSTEM_REMINDER;
  }

  shouldThankOnReturn(hold_duration_ms: number): boolean {
    return hold_duration_ms > this.settings.return_threshold_ms;
  }
}
