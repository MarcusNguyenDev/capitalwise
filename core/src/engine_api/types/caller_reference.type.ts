// Whose account, on which call. The api checks that the call's verified
// caller is this customer, at identity level 1 or more.
export interface CallerReference {
  customer_id: string;
  call_id: string;
}
