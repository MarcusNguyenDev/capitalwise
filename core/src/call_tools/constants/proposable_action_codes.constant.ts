import { CardActionParamsDto } from '../dto/action_params/card_action_params.dto';
import { HardshipRequestParamsDto } from '../dto/action_params/hardship_request_params.dto';
import { PaymentArrangementParamsDto } from '../dto/action_params/payment_arrangement_params.dto';
import { RaiseDisputeParamsDto } from '../dto/action_params/raise_dispute_params.dto';
import { RefundFeeParamsDto } from '../dto/action_params/refund_fee_params.dto';
import { ReleaseHeldPaymentParamsDto } from '../dto/action_params/release_held_payment_params.dto';
import { ReportLostStolenParamsDto } from '../dto/action_params/report_lost_stolen_params.dto';
import { RequestStatementParamsDto } from '../dto/action_params/request_statement_params.dto';
import { ServiceRequestParamsDto } from '../dto/action_params/service_request_params.dto';
import { UpdatePreferencesParamsDto } from '../dto/action_params/update_preferences_params.dto';

export interface ProposableAction {
  action_code: string;
  // What the action does, for the model, in a few words.
  purpose: string;
  // The params as the model must send them, e.g. "{card_id}".
  params_signature: string;
  // class-validator DTO the params are validated against before the api sees them.
  params_dto: new () => object;
  // Params of which at least one must be given (all optional otherwise).
  required_any_of?: string[];
  // Mirrors engine.action_types.required_identity_level, which the api enforces.
  required_identity_level: 1 | 2;
}

// HUMAN_CALLBACK is deliberately absent: the model asks for a person through
// request_human.
export const PROPOSABLE_ACTIONS: ProposableAction[] = [
  {
    action_code: 'LOCK_CARD',
    purpose: 'temporary lock the caller can undo',
    params_signature: '{card_id}',
    params_dto: CardActionParamsDto,
    required_identity_level: 1,
  },
  {
    action_code: 'REPORT_LOST_STOLEN',
    purpose: 'permanently block a lost or stolen card',
    params_signature: '{card_id, reason: LOST|STOLEN}',
    params_dto: ReportLostStolenParamsDto,
    required_identity_level: 1,
  },
  {
    action_code: 'UNLOCK_CARD',
    purpose: 'remove a temporary lock',
    params_signature: '{card_id}',
    params_dto: CardActionParamsDto,
    required_identity_level: 2,
  },
  {
    action_code: 'REPLACE_CARD',
    purpose: 'order a new card to the address on file',
    params_signature: '{card_id} (the card being replaced)',
    params_dto: CardActionParamsDto,
    required_identity_level: 2,
  },
  {
    action_code: 'ACTIVATE_CARD',
    purpose: 'activate a new card that has arrived',
    params_signature: '{card_id}',
    params_dto: CardActionParamsDto,
    required_identity_level: 2,
  },
  {
    action_code: 'REFUND_FEE',
    purpose: 'refund a fee',
    params_signature: '{fee_txn_id} (from get_fee_history)',
    params_dto: RefundFeeParamsDto,
    required_identity_level: 2,
  },
  {
    action_code: 'RAISE_DISPUTE',
    purpose: 'dispute a card or account transaction',
    params_signature:
      '{txn_id, reason: DUPLICATE|UNRECOGNISED|NOT_RECEIVED|WRONG_AMOUNT, details?}',
    params_dto: RaiseDisputeParamsDto,
    required_identity_level: 2,
  },
  {
    action_code: 'REQUEST_STATEMENT',
    purpose: 'send a statement',
    params_signature: '{account_id, months: 1-12, delivery: POST|EMAIL}',
    params_dto: RequestStatementParamsDto,
    required_identity_level: 1,
  },
  {
    action_code: 'UPDATE_PREFERENCES',
    purpose: 'paper statements, SMS alerts or large-print letters',
    params_signature:
      '{paper_statements?, sms_alerts?, large_print_letters?} (true or false, at least one)',
    params_dto: UpdatePreferencesParamsDto,
    required_any_of: ['paper_statements', 'sms_alerts', 'large_print_letters'],
    required_identity_level: 2,
  },
  {
    action_code: 'PAYMENT_ARRANGEMENT',
    purpose: 'short-term plan to catch up on a missed repayment',
    params_signature: '{account_id, weeks: 1-12, amount?} (amount per week)',
    params_dto: PaymentArrangementParamsDto,
    required_identity_level: 2,
  },
  {
    action_code: 'HARDSHIP_REQUEST',
    purpose:
      'formal financial hardship notice; a specialist decides within 21 days',
    params_signature:
      '{account_id, arrangement_type?: REPAYMENT_PAUSE|REDUCED_REPAYMENTS|TERM_EXTENSION, months?: 1-24}',
    params_dto: HardshipRequestParamsDto,
    required_identity_level: 2,
  },
  {
    action_code: 'RELEASE_HELD_PAYMENT',
    purpose: 'ask for a held payment to be released; never automatic',
    params_signature: '{txn_id} (from get_held_payments)',
    params_dto: ReleaseHeldPaymentParamsDto,
    required_identity_level: 2,
  },
  {
    action_code: 'SERVICE_REQUEST',
    purpose:
      'anything else staff must do: CHANGE_ADDRESS, CHANGE_PHONE, CHANGE_EMAIL, INCREASE_LIMIT, ADD_PAYEE, TRANSFER_MONEY, CLOSE_ACCOUNT, CANCEL_DIRECT_DEBIT, OTHER',
    params_signature: '{request_type, details?}',
    params_dto: ServiceRequestParamsDto,
    required_identity_level: 1,
  },
];

export const PROPOSABLE_ACTION_CODES = PROPOSABLE_ACTIONS.map(
  (proposable_action) => proposable_action.action_code,
);

export function findProposableAction(
  action_code: string,
): ProposableAction | undefined {
  return PROPOSABLE_ACTIONS.find(
    (proposable_action) => proposable_action.action_code === action_code,
  );
}

// One line per action for the propose_action tool description.
export function describeProposableActions(): string {
  return PROPOSABLE_ACTIONS.map(
    (proposable_action) =>
      `${proposable_action.action_code} ${proposable_action.params_signature}, identity level ${proposable_action.required_identity_level}: ${proposable_action.purpose}.`,
  ).join(' ');
}
