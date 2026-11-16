// Deterministic lines the caller hears around a system check. They are
// pre-rendered at startup so they start instantly.
export const HOLD_PHRASES = {
  CHECKING_SYSTEM_ACKNOWLEDGEMENT:
    "Thank you for that. I'll need to place you on hold for a moment while I check the system. I'll be right back with you.",
  // Used instead of the full line when one was played in the last 30 s.
  CHECKING_SYSTEM_SHORT_ACKNOWLEDGEMENTS: [
    'Thanks, just a moment while I check that for you.',
    "Thank you, I'll just check that in the system now.",
    'Thanks, bear with me for a moment while I look that up.',
  ],
  APP_APPROVAL_ACKNOWLEDGEMENT:
    "I've just sent a notification to your banking app. Please tap Approve when you see it, and I'll wait on the line.",
  CHECKING_SYSTEM_REMINDER:
    "Thanks for holding, I'm still checking that for you.",
  APP_APPROVAL_REMINDER:
    "Take your time. I'm still here, just tap Approve in your banking app when you're ready.",
  RETURN_FROM_HOLD: 'Thanks for holding.',
} as const;

export function listHoldPhrases(): string[] {
  return [
    HOLD_PHRASES.CHECKING_SYSTEM_ACKNOWLEDGEMENT,
    ...HOLD_PHRASES.CHECKING_SYSTEM_SHORT_ACKNOWLEDGEMENTS,
    HOLD_PHRASES.APP_APPROVAL_ACKNOWLEDGEMENT,
    HOLD_PHRASES.CHECKING_SYSTEM_REMINDER,
    HOLD_PHRASES.APP_APPROVAL_REMINDER,
    HOLD_PHRASES.RETURN_FROM_HOLD,
  ];
}
