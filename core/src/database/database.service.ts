import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Pool, PoolClient, types } from 'pg';

import { databaseConfig } from '../config/database.config';
import { Actor } from '../shared_kernel/types/actor.type';
import {
  PG_DATE_OID,
  PG_INT8_OID,
  PG_NUMERIC_OID,
} from './constants/pg_type_oids.constant';
import { TransactionClient } from './types/transaction_client.type';

types.setTypeParser(PG_NUMERIC_OID, (value) => parseFloat(value));
types.setTypeParser(PG_INT8_OID, (value) => parseInt(value, 10));
// Dates stay plain YYYY-MM-DD strings so they never shift across time zones.
types.setTypeParser(PG_DATE_OID, (value) => value);

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(
    @Inject(databaseConfig.KEY)
    private readonly database_config: ConfigType<typeof databaseConfig>,
  ) {}

  onModuleInit(): void {
    this.pool = new Pool({
      host: this.database_config.host,
      port: this.database_config.port,
      user: this.database_config.user,
      password: this.database_config.password,
      database: this.database_config.name,
      max: 20,
    });
    // An idle client dropping (e.g. the database restarting) must not crash the process.
    this.pool.on('error', (error) => {
      this.logger.error(`Idle database client failed: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<Row[]> {
    const query_result = await this.pool.query(sql, params);
    return query_result.rows as Row[];
  }

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
      const work_result = await work(this.wrapClient(pool_client));
      await pool_client.query('COMMIT');
      return work_result;
    } catch (error) {
      await this.rollbackQuietly(pool_client);
      throw error;
    } finally {
      pool_client.release();
    }
  }

  private wrapClient(pool_client: PoolClient): TransactionClient {
    return {
      query: async <Row>(sql: string, params: unknown[] = []) => {
        const query_result = await pool_client.query(sql, params);
        return query_result.rows as Row[];
      },
    };
  }

  private async rollbackQuietly(pool_client: PoolClient): Promise<void> {
    try {
      await pool_client.query('ROLLBACK');
    } catch (rollback_error) {
      this.logger.error(
        `Rollback failed: ${(rollback_error as Error).message}`,
      );
    }
  }
}
