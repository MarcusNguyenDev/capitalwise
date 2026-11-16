import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { parseCallScript } from './parse_call_script.util';
import { CallScript } from './types/call_script.type';

const SCRIPT_FILE_EXTENSION = '.json';

@Injectable()
export class CallScriptsLoader {
  private readonly logger = new Logger(CallScriptsLoader.name);

  // An unreadable or invalid script is logged and skipped so one bad file
  // cannot stop the service from starting.
  async loadScripts(scripts_dir: string): Promise<CallScript[]> {
    const script_file_names = await this.listScriptFiles(scripts_dir);
    const call_scripts: CallScript[] = [];
    for (const script_file_name of script_file_names) {
      try {
        const file_text = await readFile(
          join(scripts_dir, script_file_name),
          'utf8',
        );
        call_scripts.push(
          parseCallScript(JSON.parse(file_text), script_file_name),
        );
      } catch (error) {
        this.logger.error(
          `Skipped call script ${script_file_name}: ${(error as Error).message}`,
        );
      }
    }
    return call_scripts;
  }

  private async listScriptFiles(scripts_dir: string): Promise<string[]> {
    try {
      const file_names = await readdir(scripts_dir);
      return file_names
        .filter((file_name) => file_name.endsWith(SCRIPT_FILE_EXTENSION))
        .sort();
    } catch (error) {
      this.logger.error(
        `Could not read call scripts from ${scripts_dir}: ${(error as Error).message}`,
      );
      return [];
    }
  }
}
