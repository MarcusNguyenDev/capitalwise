import { IsNotEmpty, IsString } from 'class-validator';

export class LookupCustomerQueryDto {
  @IsString()
  @IsNotEmpty()
  mobile_phone: string;
}
