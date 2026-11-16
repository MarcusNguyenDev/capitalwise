export const LIVE_EVENTS_CHANNEL = 'live_events';
export const STAFF_ROOM = 'staff';

export function buildCustomerRoom(customer_id: string): string {
  return `customer:${customer_id}`;
}
