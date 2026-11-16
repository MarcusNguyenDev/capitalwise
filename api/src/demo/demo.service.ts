import { readFile } from 'fs/promises';
import { resolve } from 'path';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { AuditRecorderService } from '../audit/audit_recorder.service';
import { AUDIT_EVENT_TYPES } from '../audit/constants/audit_event_type.constant';
import { appConfig } from '../config/app.config';
import { DatabaseService } from '../database/database.service';
import { STAFF_ROOM } from '../live_events/constants/live_events_channel.constant';
import { LiveEventsPublisher } from '../live_events/live_events.publisher';
import { SYSTEM_ACTOR } from '../shared_kernel/constants/system_actor.constant';
import { DemoModeDisabledError } from './errors/demo_mode_disabled.error';

// Executed in this order: the schema drops and recreates both schemas, so a
// reset is a plain re-run of the same files that built the database.
const RESET_SQL_FILES = ['01_schema.sql', '02_seed.sql', '03_views.sql'];

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    @Inject(appConfig.KEY)
    private readonly app_settings: ConfigType<typeof appConfig>,
    private readonly database: DatabaseService,
    private readonly audit_recorder_service: AuditRecorderService,
    private readonly live_events_publisher: LiveEventsPublisher,
  ) {}

  getConfig() {
    return {
      bank_name: this.app_settings.bank_name,
      is_demo_mode: this.app_settings.is_demo_mode,
    };
  }

  async resetDemo(): Promise<{ is_reset: true }> {
    if (!this.app_settings.is_demo_mode) {
      throw new DemoModeDisabledError();
    }
    const sql_dir = resolve(process.cwd(), this.app_settings.db_sql_dir);
    const sql_scripts = await Promise.all(
      RESET_SQL_FILES.map((file_name) =>
        readFile(resolve(sql_dir, file_name), 'utf8'),
      ),
    );
    await this.database.runSqlScripts(sql_scripts);
    await this.database.runInTransaction(SYSTEM_ACTOR, (transaction) =>
      this.audit_recorder_service.recordEvent(transaction, {
        event_type: AUDIT_EVENT_TYPES.DEMO_RESET,
        detail: { sql_files: RESET_SQL_FILES },
      }),
    );
    this.logger.log({ message: 'Demo database reset', sql_dir });
    await this.live_events_publisher.publish({
      event: 'demo.reset',
      payload: {},
      rooms: [STAFF_ROOM],
    });
    return { is_reset: true };
  }
}
