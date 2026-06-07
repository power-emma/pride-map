const Pool = require('pg').Pool;

const pool = new Pool({
    user: 'pridemap',
    password: 'Postgres!',
    host: 'localhost',
    port: 5432,
    database: 'pridemap'  
});

// Without this, a dropped/idle client fires an uncaught 'error' event
// which Node treats as an unhandled exception and crashes the process.
pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
});

module.exports = pool;