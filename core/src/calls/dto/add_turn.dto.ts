import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AddTurnDto {
  @IsIn(['CUSTOMER', 'AI', 'STAFF'])
  speaker: 'CUSTOMER' | 'AI' | 'STAFF';

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  latency_ms?: number;
}
