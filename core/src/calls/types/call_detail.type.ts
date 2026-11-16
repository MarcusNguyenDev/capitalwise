import { InterventionWithStaff } from '../../interventions/types/intervention.type';
import { CallTurn } from './call_turn.type';
import { LiveCall } from './live_call.type';

export interface CallDetail {
  call: LiveCall;
  turns: CallTurn[];
  interventions: InterventionWithStaff[];
}
