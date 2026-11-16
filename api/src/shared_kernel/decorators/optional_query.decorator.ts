import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';

function isBlank(raw_value: unknown): boolean {
  return raw_value === undefined || raw_value === null || raw_value === '';
}

// Front-ends often send `?status=&call_id=` for unset filters. These treat an
// empty query value as "not provided" instead of failing validation.

export function OptionalQueryText(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => (isBlank(value) ? undefined : value)),
    IsOptional(),
  );
}

export function OptionalQueryNumber(): PropertyDecorator {
  return applyDecorators(
    Transform(({ obj, key }) =>
      isBlank(obj[key]) ? undefined : Number(obj[key]),
    ),
    IsOptional(),
  );
}
