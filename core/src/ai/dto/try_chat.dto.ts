import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class TryChatToolCallDto {
  @IsString()
  @IsNotEmpty()
  tool_call_id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  arguments: Record<string, unknown>;
}

export class TryChatMessageDto {
  @IsIn(['system', 'user', 'assistant', 'tool'])
  role: 'system' | 'user' | 'assistant' | 'tool';

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TryChatToolCallDto)
  tool_calls?: TryChatToolCallDto[];

  // Required on `tool` messages.
  @IsOptional()
  @IsString()
  tool_call_id?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class TryChatDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TryChatMessageDto)
  messages: TryChatMessageDto[];

  // `{ type: 'function', function: { name, description, parameters } }`
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  tools?: Record<string, unknown>[];
}
