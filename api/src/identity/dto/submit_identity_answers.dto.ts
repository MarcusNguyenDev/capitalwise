import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const MAX_ANSWERS = 3;
const MAX_ANSWER_LENGTH = 300;

export class IdentityAnswerDto {
  @IsString()
  @IsNotEmpty()
  question_id: string;

  // What the caller said, as text. Empty or "I don't know" counts as not
  // answered.
  @IsString()
  @MaxLength(MAX_ANSWER_LENGTH)
  answer: string;
}

export class SubmitIdentityAnswersDto {
  @IsUUID()
  call_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ANSWERS)
  @ValidateNested({ each: true })
  @Type(() => IdentityAnswerDto)
  answers: IdentityAnswerDto[];
}
