/**
 * Client-side configuration.
 *
 * Cloudflare Turnstile site key (safe to expose publicly). Set it at build time
 * via the VITE_TURNSTILE_SITE_KEY environment variable (e.g. in a .env file or
 * your CI). If unset we fall back to Cloudflare's "always passes" test site key
 * so local dev works without configuration — do NOT ship the test key to prod.
 *
 * Get a real key at: https://dash.cloudflare.com/?to=/:account/turnstile
 */

// Cloudflare-provided dummy site key that always passes. Dev only.
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

export const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || TURNSTILE_TEST_SITE_KEY;
