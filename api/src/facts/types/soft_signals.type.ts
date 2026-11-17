// The only thing the model contributes to a decision. Hard facts always come
// from the database. fraud_signals are raised by the api itself (for example
// IDENTITY_CHECK_FAILED after an identity lockout).
export interface SoftSignals {
  vulnerability_signals: string[];
  scam_coaching_signals: string[];
  fraud_signals: string[];
  quotes: string[];
}
