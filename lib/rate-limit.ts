// Per-sid concurrency cap of 3 with one 2s-backoff retry on 429.
// Nano Banana 2 preview tier is ~10 RPM.

type Limiter = <T>(fn: () => Promise<T>) => Promise<T>;

function createLimiter(concurrency: number): Limiter {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= concurrency) return;
    const run = queue.shift();
    if (run) {
      active++;
      run();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const task = () => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      };
      queue.push(task);
      next();
    });
  };
}

const limiters = new Map<string, Limiter>();

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { statusCode?: number; status?: number; message?: string };
  if (e.statusCode === 429 || e.status === 429) return true;
  const msg = (e.message ?? "").toLowerCase();
  return (
    msg.includes("rate") && (msg.includes("limit") || msg.includes("quota"))
  );
}

export async function rateLimit<T>(
  sid: string,
  fn: () => Promise<T>,
): Promise<T> {
  let lim = limiters.get(sid);
  if (!lim) {
    lim = createLimiter(3);
    limiters.set(sid, lim);
  }
  return lim(async () => {
    try {
      return await fn();
    } catch (err) {
      if (isRateLimitError(err)) {
        await sleep(2000);
        return await fn();
      }
      throw err;
    }
  });
}
