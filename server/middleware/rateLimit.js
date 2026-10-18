/**
 * Tiny in-memory sliding-window rate limiter: at most `max` actions per key
 * per `windowMs`. Resets on server restart (by design — no extra storage).
 */
function createRateLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> epoch ms of recent accepted actions

  function recent(key, now) {
    return (hits.get(key) ?? []).filter((ts) => now - ts < windowMs);
  }

  return {
    /** Seconds until `key` may act again, or 0 if it may act now. */
    retryAfter(key, now = Date.now()) {
      const times = recent(key, now);
      if (times.length < max) return 0;
      return Math.ceil((windowMs - (now - times[0])) / 1000);
    },

    record(key, now = Date.now()) {
      hits.set(key, [...recent(key, now), now]);
      // Occasionally drop stale keys so the map doesn't grow unbounded.
      if (hits.size >= 1000) {
        for (const k of hits.keys()) {
          if (recent(k, now).length === 0) hits.delete(k);
        }
      }
    },
  };
}

/** Sends the standard 429 response, or returns false if `key` is allowed. */
function rejectIfLimited(limiter, key, res, code) {
  const retryAfterSec = limiter.retryAfter(key);
  if (retryAfterSec === 0) return false;
  res.set('Retry-After', String(retryAfterSec));
  res.status(429).json({ code, retryAfterSeconds: retryAfterSec });
  return true;
}

module.exports = { createRateLimiter, rejectIfLimited };
