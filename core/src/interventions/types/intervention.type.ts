export type InterventionType =
  'MONITOR' | 'INSTRUCTION' | 'TAKEOVER' | 'HANDBACK' | 'END_CALL';

// Row of engine.interventions.
export interface Intervention {
  intervention_id: string;
  call_id: string;
  staff_id: string;
  type: InterventionType;
  text: string | null;
  created_at: Date;
}

export interface InterventionWithStaff extends Intervention {
  staff_name: string;
}
