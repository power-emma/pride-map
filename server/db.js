const Pool = require('pg').Pool;

const pool = new Pool({
    user: 'pridemap',
    password: 'Postgres!',
    host: 'localhost',
    port: 5432,
    database: 'pridemap',
    // Cap pool size so the server never exhausts DB connections
    max: 10,
    // Fail fast if the DB is unreachable rather than hanging indefinitely
    connectionTimeoutMillis: 5000,
    // Release connections that have been idle for 30 s
    idleTimeoutMillis: 30000,
    // Send TCP keepalives so NAT/firewall state doesn't silently drop idle
    // connections (common on cloud hosts), which would cause the next query
    // on a "healthy" pooled connection to hang or error unexpectedly
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});

// Without this, a dropped/idle client fires an uncaught 'error' event
// which Node treats as an unhandled exception and crashes the process.
pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
});

module.exports = pool;