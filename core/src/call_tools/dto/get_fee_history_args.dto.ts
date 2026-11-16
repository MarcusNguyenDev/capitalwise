import { IsOptional, Matches } from 'class-validator';

export class GetFeeHistoryArgsDto {
  @IsOptional()
  @Matches(/^ACC-[0-9]+$/, { message: 'account_id must look like ACC-10011' })
  account_id?: string;
}
