import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ProposeActionDto {
  @IsUUID()
  call_id: string;

  @IsString()
  @IsNotEmpty()
  action_code: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  // Falls back to the action's description when the model leaves it out.
  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  customer_statement?: string;

  // Model-written, so it is accepted loosely here and normalised to string
  // lists before use. It never becomes a hard fact.
  @IsOptional()
  @IsObject()
  soft_signals?: Record<string, unknown>;
}
