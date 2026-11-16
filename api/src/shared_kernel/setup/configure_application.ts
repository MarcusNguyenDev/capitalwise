import {
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';

import { RequestValidationError } from '../errors/request_validation.error';
import { HttpErrorFilter } from '../filters/http_error.filter';

export const GLOBAL_ROUTE_PREFIX = 'api';

function collectValidationMessages(
  validation_errors: ValidationError[],
): string[] {
  return validation_errors.flatMap((validation_error) => [
    ...Object.values(validation_error.constraints ?? {}),
    ...collectValidationMessages(validation_error.children ?? []),
  ]);
}

// Shared by main.ts and the e2e tests so both run the exact same pipeline.
export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix(GLOBAL_ROUTE_PREFIX);
  app.enableCors({ origin: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (validation_errors) =>
        new RequestValidationError(
          collectValidationMessages(validation_errors),
        ),
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();
}
