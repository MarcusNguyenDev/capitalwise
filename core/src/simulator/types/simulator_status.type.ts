export type SimulatorSpeed = 1 | 2;

export interface SimulatorStatus {
  is_running: boolean;
  speed: SimulatorSpeed;
  active_call_count: number;
  scripts: { script_id: string; title: string; customer_id: string }[];
}
