export interface ProviderHealth {
  is_reachable: boolean;
  detail: string;
  // The models the probe listed (empty when unreachable).
  models: string[];
}
