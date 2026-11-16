import { IsIn, IsOptional, IsString } from 'class-validator';

export class TranscriptDeltaDto {
  @IsString()
  call_id: string;

  @IsIn(['CUSTOMER', 'AI'])
  speaker: 'CUSTOMER' | 'AI';

  @IsString()
  delta: string;

  @IsOptional()
  @IsString()
  item_id?: string;
}
