import { Type } from 'class-transformer';
import { IsIn } from 'class-validator';

export class StartIdentityCheckArgsDto {
  // Models sometimes send the level as a string ("2").
  @Type(() => Number)
  @IsIn([1, 2], { message: 'level must be 1 or 2' })
  level: 1 | 2;
}
