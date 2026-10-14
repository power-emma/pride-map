const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../secret');

/**
 * Express middleware that requires a valid JWT Bearer token.
 * Attach to any route that should be protected (e.g. POST/PUT/DELETE locations).
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ code: 'UNAUTHENTICATED' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ code: 'INVALID_OR_EXPIRED_TOKEN' });
  }
}

module.exports = { requireAuth };
