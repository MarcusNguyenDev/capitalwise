// The only surface repositories need: the pool and an open transaction both
// satisfy it, so a repository method can run inside or outside a transaction.
export interface TransactionClient {
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<Row[]>;
}
