import { describe, expect, it } from 'vitest';
import { DEFAULT_JOB_OPTIONS } from './queues.js';

describe('default job options (JOB-009, JOB-013)', () => {
  it('retries 3 times with exponential backoff starting at 5 seconds', () => {
    expect(DEFAULT_JOB_OPTIONS.attempts).toBe(3);
    expect(DEFAULT_JOB_OPTIONS.backoff).toEqual({ type: 'exponential', delay: 5000 });
  });

  it('removes completed jobs after 24 hours and failed jobs after 7 days', () => {
    expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toEqual({ age: 24 * 60 * 60 });
    expect(DEFAULT_JOB_OPTIONS.removeOnFail).toEqual({ age: 7 * 24 * 60 * 60 });
  });
});
