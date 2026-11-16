import { IsIn, IsOptional, IsString } from 'class-validator';

export class EndCallDto {
  @IsIn(['CUSTOMER', 'AI', 'STAFF', 'SYSTEM'])
  ended_by: 'CUSTOMER' | 'AI' | 'STAFF' | 'SYSTEM';

  @IsOptional()
  @IsString()
  staff_id?: string;
}
