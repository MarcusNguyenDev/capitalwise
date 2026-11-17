import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class TrySpeechDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  voice?: string;

  // Tone guidance for providers that accept it (overrides AI_TTS_INSTRUCTIONS).
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  speed?: number;
}
