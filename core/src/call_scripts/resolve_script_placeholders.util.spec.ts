import { resolveScriptPlaceholders } from './resolve_script_placeholders.util';

const PLACEHOLDER_VALUES = {
  bank_name: 'Demo Bank',
  tool_results: {
    propose_action: {
      case_number: 'CASE-001101',
      handled_by: { staff_id: 'STF-03', name: 'Sam Patel' },
      expected_wait_minutes: null,
    },
    request_human: { specialist_name: 'Jordan Lee', expected_wait_minutes: 2 },
    lock_card: {
      card_last4: '4821',
      last_transaction: { merchant: 'Pulse Gym Cafe', amount: -8.5 },
    },
    get_customer_overview: { accounts: [{ available_balance: 2991 }] },
  },
};

describe('resolveScriptPlaceholders', () => {
  it('replaces the bank name', () => {
    expect(
      resolveScriptPlaceholders(
        "You've reached {{bank_name}}.",
        PLACEHOLDER_VALUES,
      ),
    ).toBe("You've reached Demo Bank.");
  });

  it('resolves a top-level value from the latest tool result', () => {
    expect(
      resolveScriptPlaceholders(
        'Your case is {{propose_action.case_number}}.',
        PLACEHOLDER_VALUES,
      ),
    ).toBe('Your case is CASE-001101.');
  });

  it('resolves nested paths, array indexes and numbers', () => {
    expect(
      resolveScriptPlaceholders(
        '{{propose_action.handled_by.name}} / {{lock_card.last_transaction.merchant}} / {{request_human.expected_wait_minutes}} / {{get_customer_overview.accounts.0.available_balance}}',
        PLACEHOLDER_VALUES,
      ),
    ).toBe('Sam Patel / Pulse Gym Cafe / 2 / 2991');
  });

  it('tolerates spaces inside the braces', () => {
    expect(
      resolveScriptPlaceholders(
        '{{ request_human.specialist_name }}',
        PLACEHOLDER_VALUES,
      ),
    ).toBe('Jordan Lee');
  });

  it('uses the fallback when the tool has no result or the value is missing or null', () => {
    expect(
      resolveScriptPlaceholders(
        '{{flag_concern.specialist_name|A specialist}} will join.',
        PLACEHOLDER_VALUES,
      ),
    ).toBe('A specialist will join.');
    expect(
      resolveScriptPlaceholders(
        'in {{propose_action.expected_wait_minutes|2}} minutes',
        PLACEHOLDER_VALUES,
      ),
    ).toBe('in 2 minutes');
    expect(
      resolveScriptPlaceholders(
        '{{lock_card.nope.deeper|unknown}}',
        PLACEHOLDER_VALUES,
      ),
    ).toBe('unknown');
  });

  it('never leaves raw braces behind when nothing resolves', () => {
    const resolved_text = resolveScriptPlaceholders(
      'Your reference is {{flag_concern.case_number}}.',
      PLACEHOLDER_VALUES,
    );
    expect(resolved_text).toBe('Your reference is.');
    expect(resolved_text).not.toContain('{{');
  });

  it('does not resolve objects into text', () => {
    expect(
      resolveScriptPlaceholders(
        '{{propose_action.handled_by|someone}}',
        PLACEHOLDER_VALUES,
      ),
    ).toBe('someone');
  });

  it('leaves text without placeholders untouched', () => {
    expect(
      resolveScriptPlaceholders(
        'Hi Sarah, how can I help?',
        PLACEHOLDER_VALUES,
      ),
    ).toBe('Hi Sarah, how can I help?');
  });
});
