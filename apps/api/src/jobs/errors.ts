import { UnrecoverableError } from 'bullmq';

/** Throw from a handler to fail the job at once, with no retries (JOB-009), e.g. a user not found on a provider. */
export class NonRetryableJobError extends UnrecoverableError {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableJobError';
  }
}
