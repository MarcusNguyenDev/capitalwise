import { EmptyToolArgsDto } from '../dto/empty_tool_args.dto';
import { FlagConcernArgsDto } from '../dto/flag_concern_args.dto';
import { GetFeeHistoryArgsDto } from '../dto/get_fee_history_args.dto';
import { GetLoanDetailsArgsDto } from '../dto/get_loan_details_args.dto';
import { GetRecentTransactionsArgsDto } from '../dto/get_recent_transactions_args.dto';
import { LockCardArgsDto } from '../dto/lock_card_args.dto';
import { ProposeActionArgsDto } from '../dto/propose_action_args.dto';
import { RequestHumanArgsDto } from '../dto/request_human_args.dto';
import { UpdateCallInsightArgsDto } from '../dto/update_call_insight_args.dto';
import {
  JsonSchemaObject,
  RealtimeToolDefinition,
  ToolDefinition,
  ToolName,
} from '../types/tool_definition.type';
import { PROPOSABLE_ACTION_CODES } from './proposable_action_codes.constant';

const NO_PARAMETERS: JsonSchemaObject = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
};

const STRING_LIST_SCHEMA = { type: 'array', items: { type: 'string' } };

// The single registry of the model's tools. The voice session config and the
// server-side dispatcher both read it, so they can never drift apart.
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_caller_context',
    description:
      'Match the caller ID of this call to a customer. Returns only whether it matched and the first name. Call it once at the start of the call.',
    parameters: NO_PARAMETERS,
    args_dto: EmptyToolArgsDto,
    requires_verified_identity: false,
    requires_matched_customer: false,
  },
  {
    name: 'send_identity_push',
    description:
      'Send an "Is this you calling the bank right now?" notification to the caller\'s banking app and wait up to 45 seconds for Approve or Deny. Call it before discussing or acting on any account. Tell the caller you have sent it.',
    parameters: NO_PARAMETERS,
    args_dto: EmptyToolArgsDto,
    requires_verified_identity: false,
    requires_matched_customer: true,
  },
  {
    name: 'get_customer_overview',
    description:
      "Get the verified caller's accounts (ids, nicknames, balances) and cards (ids, last four digits, status), plus tenure and whether a care flag is present.",
    parameters: NO_PARAMETERS,
    args_dto: EmptyToolArgsDto,
    requires_verified_identity: true,
    requires_matched_customer: true,
  },
  {
    name: 'get_recent_transactions',
    description:
      "List recent transactions on one of the caller's accounts, newest first.",
    parameters: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Account id from get_customer_overview, e.g. ACC-10011.',
        },
        hours: {
          type: 'integer',
          minimum: 1,
          maximum: 2160,
          description: 'How far back to look, in hours. Default 72.',
        },
      },
      required: ['account_id'],
      additionalProperties: false,
    },
    args_dto: GetRecentTransactionsArgsDto,
    requires_verified_identity: true,
    requires_matched_customer: true,
  },
  {
    name: 'get_fee_history',
    description:
      'List the fees charged to the caller in the last 13 months (with the fee transaction id needed for a refund request) and how many refunds they received in the last 12 months.',
    parameters: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Optional account id to narrow the list.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    args_dto: GetFeeHistoryArgsDto,
    requires_verified_identity: true,
    requires_matched_customer: true,
  },
  {
    name: 'get_income_summary',
    description:
      "Summarise the caller's salary and government income: the last 30 days against their usual 30 days, and month by month. Use it for hardship conversations.",
    parameters: NO_PARAMETERS,
    args_dto: EmptyToolArgsDto,
    requires_verified_identity: true,
    requires_matched_customer: true,
  },
  {
    name: 'get_loan_details',
    description:
      "Get one of the caller's loans: repayment amount and frequency, next due date, arrears, offset balance and any hardship arrangements.",
    parameters: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Loan account id from get_customer_overview.',
        },
      },
      required: ['account_id'],
      additionalProperties: false,
    },
    args_dto: GetLoanDetailsArgsDto,
    requires_verified_identity: true,
    requires_matched_customer: true,
  },
  {
    name: 'get_held_payments',
    description:
      "List the caller's payments that are currently on hold for a security review.",
    parameters: NO_PARAMETERS,
    args_dto: EmptyToolArgsDto,
    requires_verified_identity: true,
    requires_matched_customer: true,
  },
  {
    name: 'lock_card',
    description:
      "Temporarily lock one of the caller's cards (they can undo it in the app). Returns the case number and the card's last transaction so the caller can check it.",
    parameters: {
      type: 'object',
      properties: {
        card_id: {
          type: 'string',
          description: 'Card id from get_customer_overview, e.g. CRD-10011.',
        },
      },
      required: ['card_id'],
      additionalProperties: false,
    },
    args_dto: LockCardArgsDto,
    requires_verified_identity: true,
    requires_matched_customer: true,
  },
  {
    name: 'propose_action',
    description:
      "Propose an action for the bank's policy engine to decide. You never decide yourself. Params by action: REFUND_FEE {fee_txn_id}; HARDSHIP_REQUEST {account_id, arrangement_type?, months?}; RELEASE_HELD_PAYMENT {txn_id}; LOCK_CARD {card_id}. Tell the caller exactly what comes back: the case number, who is reviewing it and the expected timing. Never promise an outcome.",
    parameters: {
      type: 'object',
      properties: {
        action_code: { type: 'string', enum: PROPOSABLE_ACTION_CODES },
        params: {
          type: 'object',
          description: 'Action parameters, using ids returned by other tools.',
        },
        summary: {
          type: 'string',
          description:
            'One or two sentences for the staff member reviewing the case.',
        },
        customer_statement: {
          type: 'string',
          description: "The caller's reason in their own words.",
        },
        soft_signals: {
          type: 'object',
          description:
            'What you heard on the call. Hard facts come from the database, not from here.',
          properties: {
            vulnerability_signals: STRING_LIST_SCHEMA,
            scam_coaching_signals: STRING_LIST_SCHEMA,
            quotes: STRING_LIST_SCHEMA,
          },
        },
      },
      required: ['action_code', 'params', 'summary'],
      additionalProperties: false,
    },
    args_dto: ProposeActionArgsDto,
    requires_verified_identity: true,
    requires_matched_customer: true,
  },
  {
    name: 'request_human',
    description:
      'The caller wants to speak with a person. Routes the call to an available specialist and returns their name and the expected wait in minutes. Keep helping until they join.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why the caller wants a person, in one sentence.',
        },
      },
      required: ['reason'],
      additionalProperties: false,
    },
    args_dto: RequestHumanArgsDto,
    requires_verified_identity: false,
    requires_matched_customer: false,
  },
  {
    name: 'flag_concern',
    description:
      'Alert staff immediately about possible scam coaching or a vulnerable caller. Include short exact quotes from the caller. Returns the specialist who will speak with them and the expected wait.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['SCAM_COACHING', 'VULNERABILITY'] },
        quotes: {
          ...STRING_LIST_SCHEMA,
          description: 'Short exact quotes from the caller.',
        },
        signals: {
          ...STRING_LIST_SCHEMA,
          description:
            'Optional signal codes, e.g. TOLD_TO_MOVE_MONEY, SAFE_ACCOUNT, URGENCY, SECRECY, THIRD_PARTY_ON_LINE, REMOTE_ACCESS, CONFUSION, DISTRESS.',
        },
      },
      required: ['type', 'quotes'],
      additionalProperties: false,
    },
    args_dto: FlagConcernArgsDto,
    requires_verified_identity: false,
    requires_matched_customer: false,
  },
  {
    name: 'update_call_insight',
    description:
      "Keep the supervisor dashboard current: the caller's intent in a few words, their mood, and a one-line running summary. Call it whenever intent or mood changes.",
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          description: 'A few words, e.g. "Lost card".',
        },
        sentiment: {
          type: 'string',
          enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'DISTRESSED'],
        },
        summary: {
          type: 'string',
          description: 'One line on the call so far.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    args_dto: UpdateCallInsightArgsDto,
    requires_verified_identity: false,
    requires_matched_customer: false,
  },
];

export function findToolDefinition(
  tool_name: string,
): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find(
    (tool_definition) => tool_definition.name === (tool_name as ToolName),
  );
}

export function listRealtimeToolDefinitions(): RealtimeToolDefinition[] {
  return TOOL_DEFINITIONS.map((tool_definition) => ({
    type: 'function',
    name: tool_definition.name,
    description: tool_definition.description,
    parameters: tool_definition.parameters,
  }));
}
