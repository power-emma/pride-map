const Pool = require('pg').Pool;

const pool = new Pool({
    user: 'pridemap',
    password: 'Postgres!',
    host: 'localhost',
    port: 5432,
    database: 'pridemap'  
});

module.exports = pool;