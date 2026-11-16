// Aborts a streamed request when nothing arrives for `idle_timeout_ms`:
// the clock restarts on every chunk, so a long answer that keeps streaming
// is never cut, while a backend that stalls is.
export class IdleWatchdog {
  private readonly abort_controller = new AbortController();
  private idle_timer: NodeJS.Timeout | null = null;

  constructor(private readonly idle_timeout_ms: number) {
    this.restart();
  }

  get signal(): AbortSignal {
    return this.abort_controller.signal;
  }

  restart(): void {
    this.stop();
    this.idle_timer = setTimeout(
      () => this.abort_controller.abort(),
      this.idle_timeout_ms,
    );
  }

  stop(): void {
    if (this.idle_timer) {
      clearTimeout(this.idle_timer);
      this.idle_timer = null;
    }
  }
}
