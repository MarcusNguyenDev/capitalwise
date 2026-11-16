import { Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import { configureApplication } from './shared_kernel/setup/configure_application';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApplication(app);
  const app_settings = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  await app.listen(app_settings.port);
  new Logger('Bootstrap').log({
    message: 'api service listening',
    port: app_settings.port,
  });
}

bootstrap();
