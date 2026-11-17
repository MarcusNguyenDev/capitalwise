import { ChatToolDefinition } from '../../ai/types/chat_request.type';
import { EmptyToolArgsDto } from '../dto/empty_tool_args.dto';
import { FlagConcernArgsDto } from '../dto/flag_concern_args.dto';
import { GetFeeHistoryArgsDto } from '../dto/get_fee_history_args.dto';
import { GetLoanDetailsArgsDto } from '../dto/get_loan_details_args.dto';
import { GetRecentTransactionsArgsDto } from '../dto/get_recent_transactions_args.dto';
import { LockCardArgsDto } from '../dto/lock_card_args.dto';
import { ProposeActionArgsDto } from '../dto/propose_action_args.dto';
import { RequestHumanArgsDto } from '../dto/request_human_args.dto';
import { StartIdentityCheckArgsDto } from '../dto/start_identity_check_args.dto';
import { SubmitIdentityAnswersArgsDto } from '../dto/submit_identity_answers_args.dto';
import { UpdateCallInsightArgsDto } from '../dto/update_call_insight_args.dto';
import {
  JsonSchemaObject,
  ToolDefinition,
  ToolName,
} from '../types/tool_definition.type';
import {
  describeProposableActions,
  PROPOSABLE_ACTION_CODES,
} from './proposable_action_codes.constant';

const NO_PARAMETERS: JsonSchemaObject = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
};

const STRING_LIST_SCHEMA = { type: 'array', items: { type: 'string' } };

// The single registry of the model's tools. The voice agent's chat requests
// and the server-side dispatcher both read it, so they can never drift apart.
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_caller_context',
    description:
      'A hint only: whether the number calling is on file for a customer. It never says who the caller is, so it is never a reason to use a name. Already run for you at the start of the call.',
    parameters: NO_PARAMETERS,
    args_dto: EmptyToolArgsDto,
    required_identity_level: 0,
    requires_matched_customer: false,
  },
  {
    name: 'start_identity_check',
    description:
      "Start confirming who the caller is, only to the level the task needs. Level 1 (full name, date of birth, postcode) is enough to PROTECT the caller: lock a card, report it lost or stolen, send a statement, take a request (a reduced account overview without balances or card digits). Level 2 (level 1 plus one question about the caller's own recent activity) is needed to read account details (balances, transactions, fees, income, loans, held payments) or change anything (replace, unlock or activate a card, refunds, disputes, preferences, payment arrangements, hardship). Returns challenge_id, the questions (question_id, kind, prompt) and guidance. Ask the questions one at a time in your own warm words. At level 1 collect all three answers, then submit them together once. At level 2 ask ONE of the two questions, and offer the other only if the caller cannot answer. You never see the expected answers.",
    parameters: {
      type: 'object',
      properties: {
        level: {
          type: 'integer',
          enum: [1, 2],
          description: 'The identity level the task needs.',
        },
      },
      required: ['level'],
      additionalProperties: false,
    },
    args_dto: StartIdentityCheckArgsDto,
    required_identity_level: 0,
    requires_matched_customer: false,
  },
  {
    name: 'submit_identity_answers',
    description:
      "Send what the caller said, word for word, for the questions of a challenge from start_identity_check. Include the full name they gave earlier in the call for a FULL_NAME question. Returns is_passed, identity_level and, only when passed, the caller's first_name. When not passed it returns remaining_attempts: kindly ask again without saying which answer was wrong. When is_locked is true, do not discuss the account: say kindly that a specialist will help and stop.",
    parameters: {
      type: 'object',
      properties: {
        challenge_id: {
          type: 'string',
          description: 'challenge_id from start_identity_check.',
        },
        answers: {
          type: 'array',
          description: 'One entry per question the caller answered.',
          items: {
            type: 'object',
            properties: {
              question_id: { type: 'string' },
              answer: {
                type: 'string',
                description: "The caller's answer as they said it.",
              },
            },
            required: ['question_id', 'answer'],
            additionalProperties: false,
          },
        },
      },
      required: ['challenge_id', 'answers'],
      additionalProperties: false,
    },
    args_dto: SubmitIdentityAnswersArgsDto,
    required_identity_level: 0,
    requires_matched_customer: false,
  },
  {
    name: 'send_app_identity_check',
    description:
      'Optional, only if the caller ASKS to confirm in their banking app instead of answering questions. Sends an "Is this you calling the bank right now?" notification to the app on file for this phone number and waits up to 45 seconds for Approve or Deny. Gives identity level 1 only. Never suggest it yourself.',
    parameters: NO_PARAMETERS,
    args_dto: EmptyToolArgsDto,
    required_identity_level: 0,
    requires_matched_customer: true,
  },
  {
    name: 'get_customer_overview',
    description:
      "Get the confirmed caller's accounts and cards (ids, nicknames, status), tenure and whether a care flag is present. At identity level 1 it is a reduced view (is_reduced_view true: no balances, no card digits), enough to lock or report a card or send a statement. Balances and card digits need level 2.",
    parameters: NO_PARAMETERS,
    args_dto: EmptyToolArgsDto,
    required_identity_level: 1,
    requires_matched_customer: true,
  },
  {
    name: 'get_recent_transactions',
    description:
      "List recent transactions on one of the caller's accounts, newest first. Needs identity level 2.",
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
    required_identity_level: 2,
    requires_matched_customer: true,
  },
  {
    name: 'get_fee_history',
    description:
      'List the fees charged to the caller in the last 13 months (with the fee transaction id needed for a refund request) and how many refunds they received in the last 12 months. Needs identity level 2.',
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
    required_identity_level: 2,
    requires_matched_customer: true,
  },
  {
    name: 'get_income_summary',
    description:
      "Summarise the caller's salary and government income: the last 30 days against their usual 30 days, and month by month. Use it for hardship conversations. Needs identity level 2.",
    parameters: NO_PARAMETERS,
    args_dto: EmptyToolArgsDto,
    required_identity_level: 2,
    requires_matched_customer: true,
  },
  {
    name: 'get_loan_details',
    description:
      "Get one of the caller's loans: repayment amount and frequency, next due date, arrears, offset balance and any hardship arrangements. Needs identity level 2.",
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
    required_identity_level: 2,
    requires_matched_customer: true,
  },
  {
    name: 'get_held_payments',
    description:
      "List the caller's payments that are currently on hold for a security review. Needs identity level 2.",
    parameters: NO_PARAMETERS,
    args_dto: EmptyToolArgsDto,
    required_identity_level: 2,
    requires_matched_customer: true,
  },
  {
    name: 'lock_card',
    description:
      "Temporarily lock one of the caller's cards straight away (identity level 1). It can be unlocked later. Returns the case number and the card's last transaction so the caller can check it. Same as propose_action LOCK_CARD.",
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
    required_identity_level: 1,
    requires_matched_customer: true,
  },
  {
    name: 'propose_action',
    description: `Do a task for the caller. The bank's policy engine decides; you never decide yourself. Use ids returned by other tools. Actions, params and the identity level each needs: ${describeProposableActions()} The result has outcome (DONE, DECLINED, WITH_SPECIALIST or PENDING_REVIEW) and customer_message, one plain sentence with the real result: say it as it is, and never invent a case number, a date or a timing. If it says IDENTITY_LEVEL_REQUIRED, confirm identity to that level with start_identity_check, then try again.`,
    parameters: {
      type: 'object',
      properties: {
        action_code: { type: 'string', enum: PROPOSABLE_ACTION_CODES },
        params: {
          type: 'object',
          description:
            'Parameters of that action, exactly as listed in this description.',
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
            fraud_signals: STRING_LIST_SCHEMA,
            quotes: STRING_LIST_SCHEMA,
          },
        },
      },
      required: ['action_code', 'params', 'summary'],
      additionalProperties: false,
    },
    args_dto: ProposeActionArgsDto,
    required_identity_level: 1,
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
    required_identity_level: 0,
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
    required_identity_level: 0,
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
    required_identity_level: 0,
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

// The function-tool format of chat completions (OpenAI-style and Ollama).
export function listChatToolDefinitions(): ChatToolDefinition[] {
  return TOOL_DEFINITIONS.map((tool_definition) => ({
    type: 'function',
    function: {
      name: tool_definition.name,
      description: tool_definition.description,
      parameters: { ...tool_definition.parameters },
    },
  }));
}
