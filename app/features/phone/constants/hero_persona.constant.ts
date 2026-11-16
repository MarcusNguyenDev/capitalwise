/** The five demo personas, in the order the presenter calls them, with the story each one tells. */
export const HERO_PERSONAS = [
  { customer_id: "CUS-1001", story_label: "Lost her card", is_male: false },
  { customer_id: "CUS-1002", story_label: "Charged a $15 overdrawn fee", is_male: true },
  { customer_id: "CUS-1003", story_label: "Lost her job 5 weeks ago", is_male: false },
  { customer_id: "CUS-1004", story_label: "Her payment is stuck", is_male: false },
  { customer_id: "CUS-1005", story_label: "Third late fee refund", is_male: true },
] as const;

export const DEFAULT_CALLER_ID = "CUS-1001";

export function findHeroPersona(customer_id: string) {
  return HERO_PERSONAS.find((hero_persona) => hero_persona.customer_id === customer_id) ?? null;
}
