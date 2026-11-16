import { Module } from '@nestjs/common';

import { CallScriptsModule } from '../call_scripts/call_scripts.module';
import { ScriptedCallsController } from './scripted_calls.controller';
import { ScriptedCallsService } from './scripted_calls.service';

@Module({
  imports: [CallScriptsModule],
  controllers: [ScriptedCallsController],
  providers: [ScriptedCallsService],
})
export class ScriptedCallsModule {}
