'use strict';

/**
 * requestLogger.js
 *
 * Express middleware that appends one JSON line per request to
 * <repo-root>/logs/requests.log.
 *
 * Each line contains:
 *   timestamp, method, url, query, body (sensitive fields redacted),
 *   ip, userAgent, status, durationMs
 *
 * A write-stream opened once at startup is used so the file descriptor
 * is not recreated on every request.
 */

const fs   = require('fs');
const path = require('path');

// <repo-root>/logs/requests.log — works regardless of cwd at startup
const LOG_FILE = path.join(__dirname, '..', '..', 'logs', 'requests.log');

// Ensure the logs directory exists before opening the stream
fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

logStream.on('error', (err) => {
  console.error('[requestLogger] failed to write to log file:', err);
});

// Fields whose values are replaced with "[REDACTED]" in the body snapshot
const SENSITIVE = new Set(['password', 'password_hash', 'token', 'secret', 'authorization']);

function redactBody(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}

function requestLogger(req, res, next) {
  const startMs = Date.now();

  res.on('finish', () => {
    const bodyKeys = req.body && typeof req.body === 'object' ? Object.keys(req.body) : [];

    const entry = {
      timestamp:  new Date().toISOString(),
      method:     req.method,
      url:        req.originalUrl,
      // Only include query/body objects when they are non-empty
      ...(Object.keys(req.query).length  && { query: req.query }),
      ...(bodyKeys.length                && { body:  redactBody(req.body) }),
      ip:         req.ip || req.socket?.remoteAddress || null,
      userAgent:  req.headers['user-agent'] || null,
      // Echo back a safe subset of request headers for debugging
      headers: {
        'content-type':  req.headers['content-type']    || null,
        'accept':        req.headers['accept']           || null,
        'origin':        req.headers['origin']           || null,
        'referer':       req.headers['referer']          || null,
        // Truncate authorization to just the scheme so it's identifiable but not leakable
        'authorization': req.headers['authorization']
          ? req.headers['authorization'].split(' ')[0] + ' [REDACTED]'
          : null,
      },
      status:     res.statusCode,
      durationMs: Date.now() - startMs,
    };

    logStream.write(JSON.stringify(entry) + '\n');
  });

  next();
}

module.exports = requestLogger;
