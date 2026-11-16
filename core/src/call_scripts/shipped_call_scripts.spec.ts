import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { findToolDefinition } from '../call_tools/constants/tool_definitions.constant';
import { validateToolArgs } from '../call_tools/validate_tool_args.util';
import { InvalidCallScriptError } from './errors/invalid_call_script.error';
import { parseCallScript } from './parse_call_script.util';
import { CallScript } from './types/call_script.type';

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

function listSpokenTexts(script: CallScript): string[] {
  return script.steps.flatMap((step) => {
    if (step.type === 'ai' || step.type === 'customer') {
      return [step.text];
    }
    if (step.type === 'await_instruction') {
      return [step.ai_with_instruction, step.ai_without_instruction];
    }
    return step.type === 'await_takeover' ? [step.ai_if_timeout] : [];
  });
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

describe('shipped scripts', () => {
  const simulation_scripts = loadScripts('simulations');
  const hero_scripts = loadScripts('scripted_calls');

  it('ships the six simulations and four hero calls of the contract', () => {
    expect(simulation_scripts.map((script) => script.script_id).sort()).toEqual(
      [
        'balance_query',
        'card_lock',
        'confused_elderly',
        'fee_refund',
        'frustrated_caller',
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

  it.each([...simulation_scripts, ...hero_scripts])(
    '$script_id only calls known tools with valid arguments',
    async (script) => {
      for (const step of script.steps) {
        if (step.type !== 'tool') {
          continue;
        }
        const tool_definition = findToolDefinition(step.tool_name);
        expect(tool_definition).toBeDefined();
        const args_validation = await validateToolArgs(
          tool_definition!.args_dto,
          step.args,
        );
        expect(args_validation).toMatchObject({ is_valid: true });
      }
    },
  );

  it.each([...simulation_scripts, ...hero_scripts])(
    '$script_id verifies identity before any account tool and never asks for secrets',
    (script) => {
      let is_identity_requested = false;
      for (const step of script.steps) {
        if (step.type !== 'tool') {
          continue;
        }
        if (step.tool_name === 'send_identity_push') {
          is_identity_requested = true;
        }
        if (findToolDefinition(step.tool_name)?.requires_verified_identity) {
          expect(is_identity_requested).toBe(true);
        }
      }
      const ai_lines = script.steps
        .filter((step) => step.type === 'ai')
        .map((step) => (step as { text: string }).text.toLowerCase());
      for (const ai_line of ai_lines) {
        expect(ai_line).not.toMatch(
          /account number|passkey|password|\bpin\b|one-time code/,
        );
      }
    },
  );

  it.each(hero_scripts)(
    '$script_id uses only plain placeholders the phone client can resolve',
    (script) => {
      const called_tools = new Set(
        script.steps.flatMap((step) =>
          step.type === 'tool' ? [step.tool_name] : [],
        ),
      );
      for (const spoken_text of listSpokenTexts(script)) {
        // The {{path|fallback}} form is a core-only extension for simulations.
        expect(spoken_text).not.toMatch(/\{\{[^}]*\|/);
        for (const placeholder of spoken_text.matchAll(
          /\{\{\s*([a-z_]+)[^}]*\}\}/g,
        )) {
          const root_key = placeholder[1];
          expect(root_key === 'bank_name' || called_tools.has(root_key)).toBe(
            true,
          );
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
});
