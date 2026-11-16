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
  input_text_tokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  input_audio_tokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cached_input_tokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  output_text_tokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  output_audio_tokens?: number;
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
