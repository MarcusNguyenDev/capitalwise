// A one-consumer async iterable fed by events: push chunks, then end or fail.
export class AsyncChunkQueue<Chunk> implements AsyncIterable<Chunk> {
  private readonly buffered_chunks: Chunk[] = [];
  private waiting_reader: ((has_value: boolean) => void) | null = null;
  private is_ended = false;
  private failure: unknown = null;

  push(chunk: Chunk): void {
    if (this.is_ended) {
      return;
    }
    this.buffered_chunks.push(chunk);
    this.wakeReader();
  }

  end(): void {
    this.is_ended = true;
    this.wakeReader();
  }

  fail(error: unknown): void {
    if (this.is_ended) {
      return;
    }
    this.failure = error;
    this.end();
  }

  get has_ended(): boolean {
    return this.is_ended;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Chunk> {
    while (true) {
      if (this.buffered_chunks.length > 0) {
        yield this.buffered_chunks.shift() as Chunk;
        continue;
      }
      if (this.is_ended) {
        if (this.failure) {
          throw this.failure;
        }
        return;
      }
      await new Promise<boolean>((resolve) => {
        this.waiting_reader = resolve;
      });
    }
  }

  private wakeReader(): void {
    const waiting_reader = this.waiting_reader;
    this.waiting_reader = null;
    waiting_reader?.(true);
  }
}
