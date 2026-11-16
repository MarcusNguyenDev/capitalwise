import { Module } from '@nestjs/common';

import { CallScriptsLoader } from './call_scripts_loader.service';

@Module({
  providers: [CallScriptsLoader],
  exports: [CallScriptsLoader],
})
export class CallScriptsModule {}
