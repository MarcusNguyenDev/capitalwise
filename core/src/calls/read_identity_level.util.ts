import { CallRow, IdentityLevel } from './types/call_row.type';

// A row written before identity levels existed has only identity_verified.
export function readIdentityLevel(
  call_row: Pick<CallRow, 'identity_level' | 'identity_verified'>,
): IdentityLevel {
  return call_row.identity_level ?? (call_row.identity_verified ? 1 : 0);
}
