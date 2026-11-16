// The only thing the model contributes to a decision. Hard facts always come
// from the database.
export interface SoftSignals {
  vulnerability_signals: string[];
  scam_coaching_signals: string[];
  quotes: string[];
}
