export interface CustomerLookup {
  matched: boolean;
  customer_id: string | null;
  first_name: string | null;
  full_name: string | null;
}
