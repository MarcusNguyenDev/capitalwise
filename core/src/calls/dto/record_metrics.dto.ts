import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class CallUsageDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  llm_input_tokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  llm_output_tokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stt_audio_seconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tts_characters?: number;
}

export class RecordMetricsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CallUsageDto)
  usage?: CallUsageDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  response_time_ms?: number;
}
