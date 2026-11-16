import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Client, Pool, PoolClient, types } from 'pg';

import { databaseConfig } from '../config/database.config';
import { Actor } from '../shared_kernel/types/actor.type';
import { TransactionClient } from './types/transaction_client.type';

const INT8_OID = 20;
const DATE_OID = 1082;
const NUMERIC_OID = 1700;
// Reads made while a transaction is open use a second connection, so the
// pool is sized well above the number of concurrent writers in a demo.
const MAX_POOL_SIZE = 20;

@Injectable()
export class DatabaseService
  implements OnModuleInit, OnModuleDestroy, TransactionClient
{
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(
    @Inject(databaseConfig.KEY)
    private readonly database_settings: ConfigType<typeof databaseConfig>,
  ) {}

  onModuleInit(): void {
    // Money is numeric(14,2) and well inside the double range; dates stay as
    // plain YYYY-MM-DD strings so no time zone shifts them.
    types.setTypeParser(NUMERIC_OID, (value) => parseFloat(value));
    types.setTypeParser(INT8_OID, (value) => parseInt(value, 10));
    types.setTypeParser(DATE_OID, (value) => value);
    this.pool = new Pool({
      ...this.buildConnectionSettings(),
      max: MAX_POOL_SIZE,
    });
    this.pool.on('error', (error) =>
      this.logger.error({
        message: 'Idle database connection failed',
        error_message: error.message,
      }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<Row[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as Row[];
  }

  // Every write goes through here so the audit triggers record the right actor.
  async runInTransaction<Result>(
    actor: Actor,
    work: (transaction: TransactionClient) => Promise<Result>,
  ): Promise<Result> {
    const pool_client = await this.pool.connect();
    try {
      await pool_client.query('BEGIN');
      await pool_client.query(
        `SELECT set_config('app.actor_type', $1, true), set_config('app.actor_id', $2, true)`,
        [actor.actor_type, actor.actor_id ?? ''],
      );
      const work_result = await work(this.wrapPoolClient(pool_client));
      await pool_client.query('COMMIT');
      return work_result;
    } catch (error) {
      await pool_client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      pool_client.release();
    }
  }

  // Runs whole SQL files with the simple-query protocol on a dedicated
  // connection, as one transaction, so readers never see a half-seeded database.
  async runSqlScripts(sql_scripts: string[]): Promise<void> {
    const script_client = new Client(this.buildConnectionSettings());
    await script_client.connect();
    try {
      await script_client.query('BEGIN');
      for (const sql_script of sql_scripts) {
        await script_client.query(sql_script);
      }
      await script_client.query('COMMIT');
    } catch (error) {
      await script_client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await script_client.end();
    }
  }

  private buildConnectionSettings() {
    return {
      host: this.database_settings.host,
      port: this.database_settings.port,
      user: this.database_settings.user,
      password: this.database_settings.password,
      database: this.database_settings.database_name,
    };
  }

  private wrapPoolClient(pool_client: PoolClient): TransactionClient {
    return {
      query: async <Row>(sql: string, params: unknown[] = []) => {
        const result = await pool_client.query(sql, params);
        return result.rows as Row[];
      },
    };
  }
}
