import { IsOptional, IsString } from 'class-validator';

// The text fields of the multipart form; the audio is the `file` part.
export class TryTranscriptionDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  language?: string;
}
