import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { findProposableAction } from '../call_tools/constants/proposable_action_codes.constant';
import { findToolDefinition } from '../call_tools/constants/tool_definitions.constant';
import { validateToolArgs } from '../call_tools/validate_tool_args.util';
import { SIMULATION_START_ORDER } from '../simulator/constants/simulator_pacing.constant';
import { buildGreeting } from '../voice_agent/constants/agent_phrases.constant';
import { InvalidCallScriptError } from './errors/invalid_call_script.error';
import { parseCallScript } from './parse_call_script.util';
import { CallScript, ToolStep } from './types/call_script.type';

const CORE_ROOT_DIR = resolve(__dirname, '..', '..');

function loadScripts(folder_name: string): CallScript[] {
  const scripts_dir = join(CORE_ROOT_DIR, folder_name);
  return readdirSync(scripts_dir)
    .filter((file_name) => file_name.endsWith('.json'))
    .map((file_name) =>
      parseCallScript(
        JSON.parse(readFileSync(join(scripts_dir, file_name), 'utf8')),
        file_name,
      ),
    );
}

describe('parseCallScript', () => {
  it('rejects a script without steps', () => {
    expect(() =>
      parseCallScript(
        {
          script_id: 'x',
          title: 'X',
          customer_id: 'CUS-1',
          caller_number: '+61',
          steps: [],
        },
        'x.json',
      ),
    ).toThrow(InvalidCallScriptError);
  });

  it('rejects an unknown step type and a step with a missing field', () => {
    const script_header = {
      script_id: 'x',
      title: 'X',
      customer_id: 'CUS-1',
      caller_number: '+61',
    };
    expect(() =>
      parseCallScript(
        { ...script_header, steps: [{ type: 'sing' }] },
        'x.json',
      ),
    ).toThrow(/unknown step type/);
    expect(() =>
      parseCallScript(
        {
          ...script_header,
          steps: [{ type: 'await_takeover', timeout_seconds: 5 }],
        },
        'x.json',
      ),
    ).toThrow(/ai_if_timeout/);
  });

  it('defaults tool args to an empty object', () => {
    const script = parseCallScript(
      {
        script_id: 'x',
        title: 'X',
        customer_id: 'CUS-1',
        caller_number: '+61',
        steps: [{ type: 'tool', tool_name: 'get_caller_context' }],
      },
      'x.json',
    );
    expect(script.steps[0]).toEqual({
      type: 'tool',
      tool_name: 'get_caller_context',
      args: {},
    });
  });
});

interface SeededCustomer {
  full_name: string;
  date_of_birth: string;
  postcode: string;
}

const MONTH_NUMBERS: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

// The scripts say the seeded identity values out loud. They are read from
// db/02_seed.sql here, so a change to the seed fails this test instead of a
// demo call.
function loadSeededCustomers(): Map<string, SeededCustomer> {
  const seed_sql = readFileSync(
    join(CORE_ROOT_DIR, '..', 'db', '02_seed.sql'),
    'utf8',
  );
  const customer_row_pattern =
    /\('(CUS-\d+)',\s*'([^']+)',\s*'([^']+)',\s*DATE '(\d{4}-\d{2}-\d{2})',[^\n]*?'QLD',\s*'(\d{4})'/g;
  const seeded_customers = new Map<string, SeededCustomer>();
  for (const row_match of seed_sql.matchAll(customer_row_pattern)) {
    seeded_customers.set(row_match[1], {
      full_name: `${row_match[2]} ${row_match[3]}`,
      date_of_birth: row_match[4],
      postcode: row_match[5],
    });
  }
  return seeded_customers;
}

// "14th of September 1992" -> "1992-09-14".
function parseSpokenDate(spoken_date: string): string {
  const date_match = /^(\d{1,2})(?:st|nd|rd|th) of ([A-Za-z]+) (\d{4})$/.exec(
    spoken_date,
  );
  if (!date_match) {
    return spoken_date;
  }
  return `${date_match[3]}-${MONTH_NUMBERS[date_match[2].toLowerCase()]}-${date_match[1].padStart(2, '0')}`;
}

// The level of every identity check in order: [level, answers].
function listIdentitySubmissions(
  script: CallScript,
): { level: number; answers: { question_id: string; answer: string }[] }[] {
  let current_level = 0;
  const submissions: {
    level: number;
    answers: { question_id: string; answer: string }[];
  }[] = [];
  for (const step of script.steps) {
    if (step.type !== 'tool') {
      continue;
    }
    if (step.tool_name === 'start_identity_check') {
      current_level = Number(step.args.level);
    }
    if (step.tool_name === 'submit_identity_answers') {
      submissions.push({
        level: current_level,
        answers: step.args.answers as { question_id: string; answer: string }[],
      });
    }
  }
  return submissions;
}

function listToolSteps(script: CallScript): ToolStep[] {
  return script.steps.filter((step): step is ToolStep => step.type === 'tool');
}

describe('shipped scripts', () => {
  const simulation_scripts = loadScripts('simulations');
  const hero_scripts = loadScripts('scripted_calls');
  const all_scripts = [...simulation_scripts, ...hero_scripts];
  const seeded_customers = loadSeededCustomers();

  it('ships the simulations and the four hero calls of the contract', () => {
    expect(simulation_scripts.map((script) => script.script_id).sort()).toEqual(
      [
        'balance_query',
        'card_lock',
        'confused_elderly',
        'failed_identity',
        'fee_refund',
        'frustrated_caller',
        'landline_caller',
        'supervisor_instruction',
      ],
    );
    expect(
      hero_scripts
        .map((script) => `${script.script_id}:${script.customer_id}`)
        .sort(),
    ).toEqual([
      'daniel_fee_refund:CUS-1002',
      'margaret_scam:CUS-1004',
      'priya_hardship:CUS-1003',
      'sarah_lost_card:CUS-1001',
    ]);
  });

  it('starts every simulation, with the Jordan escalation and the whisper wait inside "Start 5"', () => {
    expect([...SIMULATION_START_ORDER].sort()).toEqual(
      simulation_scripts.map((script) => script.script_id).sort(),
    );
    expect(SIMULATION_START_ORDER.slice(0, 5)).toEqual(
      expect.arrayContaining(['frustrated_caller', 'supervisor_instruction']),
    );
  });

  it.each(all_scripts)(
    '$script_id only calls known tools with valid arguments and action params',
    async (script) => {
      for (const step of listToolSteps(script)) {
        const tool_definition = findToolDefinition(step.tool_name);
        expect(tool_definition).toBeDefined();
        const args_validation = await validateToolArgs(
          tool_definition!.args_dto,
          step.args,
        );
        expect(args_validation).toMatchObject({ is_valid: true });
        if (step.tool_name === 'propose_action') {
          const proposable_action = findProposableAction(
            String(step.args.action_code),
          );
          expect(proposable_action).toBeDefined();
          const params_validation = await validateToolArgs(
            proposable_action!.params_dto,
            step.args.params,
          );
          expect(params_validation).toMatchObject({ is_valid: true });
        }
      }
    },
  );

  it.each(all_scripts)(
    '$script_id opens with the fixed greeting that asks for the full name',
    (script) => {
      expect(script.steps[0]).toEqual({
        type: 'ai',
        text: buildGreeting('{{bank_name}}'),
      });
      expect(script.steps[1]).toMatchObject({
        type: 'tool',
        tool_name: 'get_caller_context',
      });
    },
  );

  it.each(all_scripts)(
    '$script_id confirms identity to the level each tool needs, never asks for secrets and never sends the caller to the app',
    (script) => {
      let started_level = 0;
      let confirmed_level = 0;
      for (const step of script.steps) {
        if (step.type === 'ai') {
          expect(step.text.toLowerCase()).not.toMatch(
            /account number|passkey|password|\bpin\b|one-time code|security code|\bcvv\b|\bthe app\b|banking app/,
          );
        }
        if (step.type !== 'tool') {
          continue;
        }
        if (step.tool_name === 'start_identity_check') {
          started_level = Number(step.args.level);
          // Step-up: level 2 only after level 1.
          expect(started_level - confirmed_level).toBeLessThanOrEqual(1);
        }
        if (step.tool_name === 'submit_identity_answers') {
          confirmed_level = Math.max(confirmed_level, started_level);
        }
        const required_level =
          step.tool_name === 'propose_action'
            ? findProposableAction(String(step.args.action_code))!
                .required_identity_level
            : findToolDefinition(step.tool_name)!.required_identity_level;
        expect(confirmed_level).toBeGreaterThanOrEqual(required_level);
      }
    },
  );

  it.each(all_scripts)(
    "$script_id never uses the caller's name before identity level 1",
    (script) => {
      const [first_submission] = listIdentitySubmissions(script);
      const first_name = first_submission.answers[0].answer.split(' ')[0];
      const first_submit_index = script.steps.findIndex(
        (step) =>
          step.type === 'tool' && step.tool_name === 'submit_identity_answers',
      );
      const ai_lines_before_level_one = script.steps
        .slice(0, first_submit_index)
        .filter((step) => step.type === 'ai')
        .map((step) => (step as { text: string }).text);
      for (const ai_line of ai_lines_before_level_one) {
        expect(ai_line).not.toContain(first_name);
      }
    },
  );

  it.each(
    all_scripts.filter((script) => script.script_id !== 'failed_identity'),
  )(
    '$script_id answers level 1 with the seeded name, date of birth and postcode',
    (script) => {
      const seeded_customer = seeded_customers.get(script.customer_id);
      expect(seeded_customer).toBeDefined();
      const [level_one] = listIdentitySubmissions(script);
      expect(level_one.level).toBe(1);
      expect(level_one.answers.map((answer) => answer.answer)).toEqual([
        seeded_customer!.full_name,
        expect.any(String),
        seeded_customer!.postcode,
      ]);
      expect(parseSpokenDate(level_one.answers[1].answer)).toBe(
        seeded_customer!.date_of_birth,
      );
    },
  );

  it('fails the impostor with details that match no seeded customer', () => {
    const failed_identity = simulation_scripts.find(
      (script) => script.script_id === 'failed_identity',
    )!;
    const submissions = listIdentitySubmissions(failed_identity);
    expect(submissions).toHaveLength(2);
    for (const submission of submissions) {
      const [full_name, spoken_date, postcode] = submission.answers.map(
        (answer) => answer.answer,
      );
      const matching_customers = [...seeded_customers.values()].filter(
        (seeded_customer) =>
          seeded_customer.full_name === full_name &&
          seeded_customer.date_of_birth === parseSpokenDate(spoken_date) &&
          seeded_customer.postcode === postcode,
      );
      expect(matching_customers).toEqual([]);
    }
    expect(
      listToolSteps(failed_identity).some((step) =>
        ['propose_action', 'lock_card', 'get_customer_overview'].includes(
          step.tool_name,
        ),
      ),
    ).toBe(false);
  });

  it('calls from a landline that is not on file in the landline story', () => {
    const landline_caller = simulation_scripts.find(
      (script) => script.script_id === 'landline_caller',
    )!;
    expect(landline_caller.caller_number).not.toMatch(/^\+614/);
  });

  it.each(hero_scripts)(
    '$script_id uses only plain placeholders the phone client can resolve, after the tool ran',
    (script) => {
      const called_tools = new Set<string>();
      for (const step of script.steps) {
        const step_texts =
          step.type === 'tool'
            ? [JSON.stringify(step.args)]
            : step.type === 'ai' || step.type === 'customer'
              ? [step.text]
              : step.type === 'await_instruction'
                ? [step.ai_with_instruction, step.ai_without_instruction]
                : step.type === 'await_takeover'
                  ? [step.ai_if_timeout]
                  : [];
        for (const step_text of step_texts) {
          // The {{path|fallback}} form is a core-only extension for simulations.
          expect(step_text).not.toMatch(/\{\{[^}]*\|/);
          for (const placeholder of step_text.matchAll(
            /\{\{\s*([a-z_]+)[^}]*\}\}/g,
          )) {
            const root_key = placeholder[1];
            expect(root_key === 'bank_name' || called_tools.has(root_key)).toBe(
              true,
            );
          }
        }
        if (step.type === 'tool') {
          called_tools.add(step.tool_name);
        }
      }
    },
  );

  it('places the supervisor whisper before the proposal in Priya and Ava', () => {
    const scripts_with_whisper = [
      hero_scripts.find((script) => script.script_id === 'priya_hardship')!,
      simulation_scripts.find(
        (script) => script.script_id === 'supervisor_instruction',
      )!,
    ];
    for (const script of scripts_with_whisper) {
      const whisper_index = script.steps.findIndex(
        (step) => step.type === 'await_instruction',
      );
      const proposal_index = script.steps.findIndex(
        (step) => step.type === 'tool' && step.tool_name === 'propose_action',
      );
      expect(whisper_index).toBeGreaterThan(-1);
      expect(whisper_index).toBeLessThan(proposal_index);
    }
  });

  it('keeps the takeover point in Margaret and never proposes a release of the held money', () => {
    const margaret = hero_scripts.find(
      (script) => script.script_id === 'margaret_scam',
    )!;
    const concern_index = margaret.steps.findIndex(
      (step) => step.type === 'tool' && step.tool_name === 'flag_concern',
    );
    const takeover_index = margaret.steps.findIndex(
      (step) => step.type === 'await_takeover',
    );
    expect(concern_index).toBeGreaterThan(-1);
    expect(takeover_index).toBeGreaterThan(concern_index);
    expect(JSON.stringify(margaret.steps)).not.toContain(
      'RELEASE_HELD_PAYMENT',
    );
  });
});
