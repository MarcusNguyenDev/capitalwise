import { IsIn, IsOptional, IsString } from 'class-validator';

export class JoinRoomsDto {
  @IsIn(['STAFF', 'PHONE'])
  role: 'STAFF' | 'PHONE';

  @IsOptional()
  @IsString()
  staff_id?: string;

  @IsOptional()
  @IsString()
  call_id?: string;

  @IsOptional()
  @IsString()
  customer_id?: string;
}
