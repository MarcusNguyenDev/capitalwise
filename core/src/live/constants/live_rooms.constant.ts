export const STAFF_ROOM = 'staff';

export function buildCallRoom(call_id: string): string {
  return `call:${call_id}`;
}

export function buildCustomerRoom(customer_id: string): string {
  return `customer:${customer_id}`;
}
