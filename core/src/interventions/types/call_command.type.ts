export type CallCommandName =
  'INSTRUCTION' | 'TAKEOVER' | 'HANDBACK' | 'END_CALL' | 'STAFF_MESSAGE';

// Payload of the `call.command` live event sent to the phone of a call.
export interface CallCommand {
  call_id: string;
  command: CallCommandName;
  text: string | null;
  staff_id: string;
  staff_name: string;
  intervention_id: string | null;
}
