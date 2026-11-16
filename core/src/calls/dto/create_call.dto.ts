import { IsIn, IsOptional, Matches } from 'class-validator';

import { CallMode } from '../types/call_metrics.type';
import { CallChannel } from '../types/call_row.type';

export class CreateCallDto {
  @Matches(/^\+?[0-9]{6,15}$/, {
    message: 'caller_number must be a phone number in E.164 format',
  })
  caller_number: string;

  @IsIn(['BROWSER', 'PHONE', 'SIMULATED'])
  channel: CallChannel;

  @IsOptional()
  @IsIn(['LIVE', 'SCRIPTED'])
  mode?: CallMode;
}
