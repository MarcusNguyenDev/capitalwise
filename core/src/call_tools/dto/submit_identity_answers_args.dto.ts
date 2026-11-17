import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class IdentityAnswerArgsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  question_id: string;

  // What the caller said, as text. The api compares it; core never sees the
  // expected value.
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  answer: string;
}

export class SubmitIdentityAnswersArgsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  challenge_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => IdentityAnswerArgsDto)
  answers: IdentityAnswerArgsDto[];
}
