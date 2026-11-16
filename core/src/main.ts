import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import { collectValidationMessages } from './shared_kernel/collect_validation_messages.util';
import { RequestValidationError } from './shared_kernel/errors/request_validation.error';
import { HttpErrorFilter } from './shared_kernel/filters/http_error.filter';

const logger = new Logger('Bootstrap');

// A live demo must survive a stray rejection (a dropped socket, a late
// timer): log it instead of letting Node terminate the process.
process.on('unhandledRejection', (reason) => {
  logger.error(
    `Unhandled promise rejection: ${reason instanceof Error ? reason.stack : String(reason)}`,
  );
});

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const app_config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  app.setGlobalPrefix('core');
  app.enableCors({ origin: '*' });
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

  await app.listen(app_config.port);
  logger.log(`core listening on port ${app_config.port} (prefix /core)`);
}

void bootstrap();
