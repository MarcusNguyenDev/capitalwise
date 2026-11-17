import { HOLD_PHRASES } from './constants/hold_phrases.constant';
import {
  classifyToolHold,
  findHoldReason,
  ToolHoldClass,
} from './constants/tool_hold_classes.constant';
import {
  FULL_ACKNOWLEDGEMENT_COOLDOWN_MS,
  HoldPolicy,
  MAX_HOLD_REMINDERS,
} from './hold.policy';

function buildPolicy() {
  let now_ms = 1_000_000;
  const hold_policy = new HoldPolicy(
    { reminder_interval_ms: 8_000, return_threshold_ms: 2_500 },
    () => now_ms,
  );
  return {
    hold_policy,
    advanceClock: (elapsed_ms: number) => {
      now_ms += elapsed_ms;
    },
  };
}

describe('tool hold classes', () => {
  it('classifies silent, app-approval and system-check tools', () => {
    expect(classifyToolHold('get_caller_context')).toBe(ToolHoldClass.SILENT);
    expect(classifyToolHold('update_call_insight')).toBe(ToolHoldClass.SILENT);
    expect(classifyToolHold('send_identity_push')).toBe(
      ToolHoldClass.APP_APPROVAL,
    );
    for (const tool_name of [
      'get_customer_overview',
      'get_recent_transactions',
      'lock_card',
      'propose_action',
      'request_human',
      'flag_concern',
    ]) {
      expect(classifyToolHold(tool_name)).toBe(ToolHoldClass.CHECKING_SYSTEM);
    }
    expect(classifyToolHold('transfer_money')).toBe(ToolHoldClass.SILENT);
  });

  it('picks one reason for a batch: approval first, silent batches need none', () => {
    expect(
      findHoldReason(['update_call_insight', 'get_caller_context']),
    ).toBeNull();
    expect(findHoldReason(['update_call_insight', 'get_fee_history'])).toBe(
      'CHECKING_SYSTEM',
    );
    expect(
      findHoldReason(['get_customer_overview', 'send_identity_push']),
    ).toBe('WAITING_FOR_APP_APPROVAL');
  });
});

describe('HoldPolicy', () => {
  it('plays the full hold line, then rotating short variants within 30 s', () => {
    const { hold_policy, advanceClock } = buildPolicy();

    const first_line = hold_policy.chooseAcknowledgement('CHECKING_SYSTEM');
    advanceClock(10_000);
    const second_line = hold_policy.chooseAcknowledgement('CHECKING_SYSTEM');
    advanceClock(5_000);
    const third_line = hold_policy.chooseAcknowledgement('CHECKING_SYSTEM');

    expect(first_line).toBe(HOLD_PHRASES.CHECKING_SYSTEM_ACKNOWLEDGEMENT);
    expect(second_line).toBe(
      HOLD_PHRASES.CHECKING_SYSTEM_SHORT_ACKNOWLEDGEMENTS[0],
    );
    expect(third_line).toBe(
      HOLD_PHRASES.CHECKING_SYSTEM_SHORT_ACKNOWLEDGEMENTS[1],
    );
  });

  it('plays the full line again once 30 s have passed since the last full one', () => {
    const { hold_policy, advanceClock } = buildPolicy();

    hold_policy.chooseAcknowledgement('CHECKING_SYSTEM');
    advanceClock(FULL_ACKNOWLEDGEMENT_COOLDOWN_MS);

    expect(hold_policy.chooseAcknowledgement('CHECKING_SYSTEM')).toBe(
      HOLD_PHRASES.CHECKING_SYSTEM_ACKNOWLEDGEMENT,
    );
  });

  it('always gives the app-approval instructions in full', () => {
    const { hold_policy } = buildPolicy();

    hold_policy.chooseAcknowledgement('CHECKING_SYSTEM');

    expect(hold_policy.chooseAcknowledgement('WAITING_FOR_APP_APPROVAL')).toBe(
      HOLD_PHRASES.APP_APPROVAL_ACKNOWLEDGEMENT,
    );
    expect(hold_policy.chooseAcknowledgement('WAITING_FOR_APP_APPROVAL')).toBe(
      HOLD_PHRASES.APP_APPROVAL_ACKNOWLEDGEMENT,
    );
  });

  it('gives at most three reminders, worded for the reason', () => {
    const { hold_policy } = buildPolicy();

    const reminders = [0, 1, 2, 3].map((reminders_played) =>
      hold_policy.chooseReminder('WAITING_FOR_APP_APPROVAL', reminders_played),
    );

    expect(MAX_HOLD_REMINDERS).toBe(3);
    expect(reminders.slice(0, 3)).toEqual([
      HOLD_PHRASES.APP_APPROVAL_REMINDER,
      HOLD_PHRASES.APP_APPROVAL_REMINDER,
      HOLD_PHRASES.APP_APPROVAL_REMINDER,
    ]);
    expect(reminders[3]).toBeNull();
    expect(hold_policy.chooseReminder('CHECKING_SYSTEM', 0)).toBe(
      HOLD_PHRASES.CHECKING_SYSTEM_REMINDER,
    );
  });

  it('thanks the caller for holding only after a hold longer than the threshold', () => {
    const { hold_policy } = buildPolicy();

    expect(hold_policy.shouldThankOnReturn(800)).toBe(false);
    expect(hold_policy.shouldThankOnReturn(2_500)).toBe(false);
    expect(hold_policy.shouldThankOnReturn(2_501)).toBe(true);
    expect(hold_policy.reminder_interval_ms).toBe(8_000);
  });
});
