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
  llm_cached_input_tokens?: number;

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

  @IsOptional()
  @IsInt()
  @Min(0)
  tts_input_tokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tts_cached_input_tokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tts_output_audio_tokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tts_output_text_tokens?: number;
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
