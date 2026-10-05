/**
 * Runtime configuration for the server.
 *
 * Cloudflare Turnstile (CAPTCHA) secret key:
 *   Set the TURNSTILE_SECRET_KEY environment variable in production (export it
 *   in run-server.sh / your process manager). If it is not set we fall back to
 *   Cloudflare's "always passes" test secret so local dev works out of the box
 *   without a real key. NEVER rely on the test key in production — it accepts
 *   any token and provides no bot protection.
 *
 *   Get real keys at: https://dash.cloudflare.com/?to=/:account/turnstile
 */

// Cloudflare-provided dummy secret that always returns success. Dev only.
const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';

const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || TURNSTILE_TEST_SECRET;

const usingTestTurnstileKey = turnstileSecret === TURNSTILE_TEST_SECRET;

if (usingTestTurnstileKey) {
  console.warn(
    '[config] TURNSTILE_SECRET_KEY is not set — using Cloudflare test key. ' +
    'CAPTCHA will accept any token. Set a real key before deploying.'
  );
}

module.exports = { turnstileSecret, usingTestTurnstileKey };
