import { SoftSignals } from '../types/soft_signals.type';

function toUniqueStrings(candidates: unknown): string[] {
  if (!Array.isArray(candidates)) {
    return [];
  }
  const text_items = candidates.filter(
    (candidate): candidate is string => typeof candidate === 'string',
  );
  return [...new Set(text_items)];
}

export function normaliseSoftSignals(
  raw_soft_signals:
    Partial<Record<keyof SoftSignals, unknown>> | null | undefined,
): SoftSignals {
  return {
    vulnerability_signals: toUniqueStrings(
      raw_soft_signals?.vulnerability_signals,
    ),
    scam_coaching_signals: toUniqueStrings(
      raw_soft_signals?.scam_coaching_signals,
    ),
    fraud_signals: toUniqueStrings(raw_soft_signals?.fraud_signals),
    quotes: toUniqueStrings(raw_soft_signals?.quotes),
  };
}

export function mergeSoftSignals(
  existing_soft_signals: Partial<SoftSignals> | null | undefined,
  added_soft_signals: Partial<SoftSignals> | null | undefined,
): SoftSignals {
  const existing = normaliseSoftSignals(existing_soft_signals);
  const added = normaliseSoftSignals(added_soft_signals);
  return normaliseSoftSignals({
    vulnerability_signals: [
      ...existing.vulnerability_signals,
      ...added.vulnerability_signals,
    ],
    scam_coaching_signals: [
      ...existing.scam_coaching_signals,
      ...added.scam_coaching_signals,
    ],
    fraud_signals: [...existing.fraud_signals, ...added.fraud_signals],
    quotes: [...existing.quotes, ...added.quotes],
  });
}
