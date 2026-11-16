import { IsObject, IsOptional } from 'class-validator';

export class DispatchToolDto {
  // Validated per tool by the dispatcher, so a bad argument is answered with
  // `ok: false` for the model instead of an HTTP 400.
  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;
}
