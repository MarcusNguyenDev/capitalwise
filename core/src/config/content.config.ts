import { resolve } from 'node:path';

import { registerAs } from '@nestjs/config';

// The content folders sit beside `src` (and beside `dist` after a build), two
// levels above this file in both layouts.
const CORE_ROOT_DIR = resolve(__dirname, '..', '..');

export const contentConfig = registerAs('content', () => ({
  prompts_dir: process.env.PROMPTS_DIR ?? resolve(CORE_ROOT_DIR, 'prompts'),
  simulations_dir:
    process.env.SIMULATIONS_DIR ?? resolve(CORE_ROOT_DIR, 'simulations'),
  scripted_calls_dir:
    process.env.SCRIPTED_CALLS_DIR ?? resolve(CORE_ROOT_DIR, 'scripted_calls'),
}));
