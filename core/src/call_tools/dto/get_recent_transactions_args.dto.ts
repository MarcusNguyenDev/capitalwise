import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class GetRecentTransactionsArgsDto {
  @Matches(/^ACC-[0-9]+$/, { message: 'account_id must look like ACC-10011' })
  account_id: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2160)
  hours?: number;
}
