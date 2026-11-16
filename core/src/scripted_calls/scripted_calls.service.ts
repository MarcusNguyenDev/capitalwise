import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { CallScriptsLoader } from '../call_scripts/call_scripts_loader.service';
import {
  CallScript,
  CallScriptSummary,
} from '../call_scripts/types/call_script.type';
import { contentConfig } from '../config/content.config';
import { ScriptedCallNotFoundError } from './errors/scripted_call_not_found.error';

// core only serves the hero-call scripts: the phone client replays them with
// speech synthesis through the normal call, turn and tool endpoints.
@Injectable()
export class ScriptedCallsService implements OnModuleInit {
  private readonly logger = new Logger(ScriptedCallsService.name);
  private scripted_calls: CallScript[] = [];

  constructor(
    private readonly call_scripts_loader: CallScriptsLoader,
    @Inject(contentConfig.KEY)
    private readonly content_config: ConfigType<typeof contentConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    const loaded_scripts = await this.call_scripts_loader.loadScripts(
      this.content_config.scripted_calls_dir,
    );
    // Listed in customer order: Sarah, Daniel, Priya, Margaret.
    this.scripted_calls = loaded_scripts.sort((first_script, second_script) =>
      first_script.customer_id.localeCompare(second_script.customer_id),
    );
    this.logger.log(`Loaded ${this.scripted_calls.length} scripted hero calls`);
  }

  listScriptedCalls(): CallScriptSummary[] {
    return this.scripted_calls.map((scripted_call) => ({
      script_id: scripted_call.script_id,
      title: scripted_call.title,
      customer_id: scripted_call.customer_id,
      caller_number: scripted_call.caller_number,
    }));
  }

  getScriptedCall(customer_id: string): CallScript {
    const scripted_call = this.scripted_calls.find(
      (each_script) => each_script.customer_id === customer_id,
    );
    if (!scripted_call) {
      throw new ScriptedCallNotFoundError(customer_id);
    }
    return scripted_call;
  }
}
