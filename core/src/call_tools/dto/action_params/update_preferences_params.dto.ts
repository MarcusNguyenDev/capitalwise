import { IsBoolean, IsOptional } from 'class-validator';

// At least one preference must be given; see hasAnyPreference.
export class UpdatePreferencesParamsDto {
  @IsOptional()
  @IsBoolean()
  paper_statements?: boolean;

  @IsOptional()
  @IsBoolean()
  sms_alerts?: boolean;

  @IsOptional()
  @IsBoolean()
  large_print_letters?: boolean;
}
