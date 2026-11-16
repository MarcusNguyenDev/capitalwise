export type ActorType = 'AI' | 'STAFF' | 'SYSTEM' | 'CUSTOMER';

export interface Actor {
  actor_type: ActorType;
  actor_id: string | null;
}
