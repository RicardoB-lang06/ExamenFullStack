export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  const attempts = new Map();
  const safeLimit = Math.max(1, Number(limit));
  const safeWindowMs = Math.max(1_000, Number(windowMs));
  let operations = 0;

  function consume(key) {
    const timestamp = now();
    operations += 1;
    if (operations % 100 === 0) {
      for (const [storedKey, storedEntry] of attempts) {
        if (storedEntry.resetAt <= timestamp) attempts.delete(storedKey);
      }
    }
    let entry = attempts.get(key);

    if (!entry || entry.resetAt <= timestamp) {
      entry = { count: 0, resetAt: timestamp + safeWindowMs };
    }

    if (entry.count >= safeLimit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1_000)),
      };
    }

    entry.count += 1;
    attempts.set(key, entry);
    return {
      allowed: true,
      remaining: safeLimit - entry.count,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1_000)),
    };
  }

  return {
    consume,
    reset(key) {
      attempts.delete(key);
    },
  };
}
