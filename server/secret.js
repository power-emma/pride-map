/**
 * Loads the JWT signing secret from `../jwt-secret` (relative to the server
 * directory).  If the file does not exist it is created with a freshly
 * generated 64-byte random hex string so the server is ready to run without
 * any extra configuration steps.
 *
 * The file is listed in .gitignore and should never be committed.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECRET_PATH = path.join(__dirname, '..', 'jwt-secret');

function loadOrCreateSecret() {
  if (fs.existsSync(SECRET_PATH)) {
    const secret = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    if (secret.length < 32) {
      throw new Error(`jwt-secret file exists but looks too short — please delete it and restart to regenerate.`);
    }
    return secret;
  }

  const secret = crypto.randomBytes(64).toString('hex');
  fs.writeFileSync(SECRET_PATH, secret, { mode: 0o600 }); // owner-read/write only
  console.log(`Generated new JWT secret → ${SECRET_PATH}`);
  return secret;
}

const jwtSecret = loadOrCreateSecret();

module.exports = { jwtSecret };
