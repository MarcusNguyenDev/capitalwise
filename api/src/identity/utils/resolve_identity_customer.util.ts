export interface CustomerResolution {
  // The customer the call is bound to, or null when it is a failed attempt.
  customer_id: string | null;
  resolution: 'CALLER_ID' | 'SOLE_MATCH' | 'NO_MATCH' | 'AMBIGUOUS';
}

// The caller-ID customer wins if the answers fit them. Otherwise the answers
// must fit exactly one customer (a landline not on file, or a spouse calling
// from a shared number). None or several is a failed attempt.
export function resolveIdentityCustomer(
  matching_customer_ids: string[],
  caller_id_customer_id: string | null,
): CustomerResolution {
  if (
    caller_id_customer_id &&
    matching_customer_ids.includes(caller_id_customer_id)
  ) {
    return { customer_id: caller_id_customer_id, resolution: 'CALLER_ID' };
  }
  if (matching_customer_ids.length === 1) {
    return { customer_id: matching_customer_ids[0], resolution: 'SOLE_MATCH' };
  }
  return {
    customer_id: null,
    resolution: matching_customer_ids.length === 0 ? 'NO_MATCH' : 'AMBIGUOUS',
  };
}
