import { Writable } from 'node:stream';

/** In-memory pino destination that keeps the raw output for assertions. */
export class LogCapture extends Writable {
  private chunks: string[] = [];

  override _write(
    chunk: Buffer | string,
    _enc: BufferEncoding,
    cb: (error?: Error | null) => void,
  ) {
    this.chunks.push(chunk.toString());
    cb();
  }

  get raw(): string {
    return this.chunks.join('');
  }

  get lines(): Record<string, unknown>[] {
    return this.raw
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  }
}
