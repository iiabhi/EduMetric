import type { Prisma } from '../generated/prisma/client.js';
import type { Db } from './prisma.js';

/** Client handed to a transaction callback. Repositories accept it in place of the normal client. */
export type Tx = Prisma.TransactionClient;
/** Either the normal client or a transaction client; what a repository factory takes. */
export type DbClient = Db | Tx;

const MAX_WAIT_MS = 5000;
const TIMEOUT_MS = 10_000;

/**
 * Run `fn` in one database transaction (DB-006): everything commits together, or everything rolls
 * back if `fn` throws. Services call this and hand `tx` to the repositories they use.
 */
export const withTransaction = <T>(
  db: Pick<Db, '$transaction'>,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> => db.$transaction(fn, { maxWait: MAX_WAIT_MS, timeout: TIMEOUT_MS });
