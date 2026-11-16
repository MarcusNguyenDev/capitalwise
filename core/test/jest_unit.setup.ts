import 'reflect-metadata';

import { Logger } from '@nestjs/common';

// Expected-failure paths log errors on purpose; keep the test output readable.
Logger.overrideLogger(false);
