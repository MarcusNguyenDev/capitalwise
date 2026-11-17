/**
 * The demo callers, in the order the presenter uses them. The first is the
 * presenter's own unscripted story: it calls as Marcus Edward and always runs
 * Live, because there is no script. The others tell a fixed story and also
 * have a scripted replay. `title` null means the list shows the caller's name.
 */
export const HERO_PERSONAS = [
  { customer_id: "CUS-1007", title: "Your own story", story_label: "Describe any problem in your own words", is_male: true, is_unscripted: true },
  { customer_id: "CUS-1001", title: null, story_label: "Lost her card", is_male: false, is_unscripted: false },
  { customer_id: "CUS-1002", title: null, story_label: "Charged a $15 overdrawn fee", is_male: true, is_unscripted: false },
  { customer_id: "CUS-1003", title: null, story_label: "Lost her job 5 weeks ago", is_male: false, is_unscripted: false },
  { customer_id: "CUS-1004", title: null, story_label: "Her payment is stuck", is_male: false, is_unscripted: false },
  { customer_id: "CUS-1005", title: null, story_label: "Third late fee refund", is_male: true, is_unscripted: false },
] as const;

export const DEFAULT_CALLER_ID = "CUS-1001";

export function findHeroPersona(customer_id: string) {
  return HERO_PERSONAS.find((hero_persona) => hero_persona.customer_id === customer_id) ?? null;
}

/** The unscripted caller has no replay, so the call always runs Live. */
export function isUnscriptedCaller(customer_id: string): boolean {
  return findHeroPersona(customer_id)?.is_unscripted ?? false;
}
