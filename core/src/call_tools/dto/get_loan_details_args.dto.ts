import { Matches } from 'class-validator';

export class GetLoanDetailsArgsDto {
  @Matches(/^ACC-[0-9]+$/, { message: 'account_id must look like ACC-10031' })
  account_id: string;
}
