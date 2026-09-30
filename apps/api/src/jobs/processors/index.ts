import type { JobHandler } from '../worker.js';
import { noopHandler } from './noop.js';

/** Every job the worker process handles. New features add their handlers here. */
export const handlers: JobHandler[] = [noopHandler];
