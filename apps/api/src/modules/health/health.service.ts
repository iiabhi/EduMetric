export interface ReadinessCheck {
  name: string;
  check: () => Promise<boolean>;
}

export interface ReadinessResult {
  ready: boolean;
  failed: string[];
}

const DEFAULT_TIMEOUT_MS = 1500;

const runCheck = async (check: ReadinessCheck, timeoutMs: number): Promise<boolean> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);
  });
  try {
    return await Promise.race([check.check(), timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

/** Runs all checks in parallel. A check that throws, returns false or hangs counts as failed. */
export const createReadinessService = (
  checks: ReadinessCheck[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
) => ({
  async run(): Promise<ReadinessResult> {
    const results = await Promise.all(
      checks.map(async (c) => ({ name: c.name, ok: await runCheck(c, timeoutMs) })),
    );
    const failed = results.filter((r) => !r.ok).map((r) => r.name);
    return { ready: failed.length === 0, failed };
  },
});

export type ReadinessService = ReturnType<typeof createReadinessService>;
