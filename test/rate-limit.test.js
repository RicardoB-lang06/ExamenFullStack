import assert from 'node:assert/strict';
import test from 'node:test';

import { createRateLimiter } from '../server/rate-limit.js';

test('createRateLimiter bloquea y restablece intentos por clave', () => {
  let timestamp = 1_000;
  const limiter = createRateLimiter({
    limit: 2,
    windowMs: 60_000,
    now: () => timestamp,
  });

  assert.equal(limiter.consume('user').allowed, true);
  assert.equal(limiter.consume('user').allowed, true);
  assert.equal(limiter.consume('user').allowed, false);

  limiter.reset('user');
  assert.equal(limiter.consume('user').allowed, true);

  timestamp += 60_000;
  assert.equal(limiter.consume('user').allowed, true);
});
