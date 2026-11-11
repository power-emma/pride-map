const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../secret');
const { getUserById } = require('../userStore');

/**
 * Express middleware that requires a valid JWT Bearer token for a live account.
 * The account is re-read on every request so deleted users and approved
 * password changes take effect immediately rather than when the token expires.
 * Sets req.user = { id, username, email, isAdmin }.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ code: 'UNAUTHENTICATED' });
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    return res.status(401).json({ code: 'INVALID_OR_EXPIRED_TOKEN' });
  }

  // Tokens issued before accounts existed only carry a username.
  if (!Number.isInteger(payload?.id)) {
    return res.status(401).json({ code: 'INVALID_OR_EXPIRED_TOKEN' });
  }

  try {
    const user = await getUserById(payload.id);
    if (!user) {
      return res.status(401).json({ code: 'INVALID_OR_EXPIRED_TOKEN' });
    }
    if (user.password_changed_at) {
      const changedAtSec = Math.floor(new Date(user.password_changed_at).getTime() / 1000);
      if (payload.iat < changedAtSec) {
        return res.status(401).json({ code: 'INVALID_OR_EXPIRED_TOKEN' });
      }
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email ?? null,
      isAdmin: user.is_admin === true,
      regionAdminIds: Array.isArray(user.region_admin_ids) ? user.region_admin_ids.map(Number) : [],
    };
    return next();
  } catch (error) {
    console.error('Error loading authenticated user:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
}

/** Like requireAuth, but also requires an admin account. */
function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ code: 'ADMIN_REQUIRED' });
    }
    return next();
  });
}

function requireRegionalAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (!req.user.isAdmin && req.user.regionAdminIds.length === 0) {
      return res.status(403).json({ code: 'ADMIN_REQUIRED' });
    }
    return next();
  });
}

function canManageRegion(user, regionId) {
  return user.isAdmin || user.regionAdminIds.includes(Number(regionId));
}

/**
 * SQL fragment restricting a row to the current user's own content. Admins can
 * manage everything, so they get no restriction. Pushes the user id onto
 * `params` and returns e.g. " AND owner_id = $4".
 */
function ownershipFilter(user, params, column = 'owner_id') {
  if (user.isAdmin) return '';
  if (user.regionAdminIds?.length) {
    params.push(user.regionAdminIds);
    const regionFilter = `region_id = ANY($${params.length}::int[])`;
    params.push(user.id);
    return ` AND (${regionFilter} OR ${column} = $${params.length})`;
  }
  params.push(user.id);
  return ` AND ${column} = $${params.length}`;
}

module.exports = { requireAuth, requireAdmin, requireRegionalAdmin, canManageRegion, ownershipFilter };
