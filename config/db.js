require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
    host:            process.env.DB_HOST            || 'localhost',
    user:            process.env.DB_USER            || 'banka_admin',
    password:        process.env.DB_PASSWORD        || '',
    database:        process.env.DB_NAME            || 'secure_bank_db',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit:      0,
    timezone:        'Z',
});

const promisePool = pool.promise();

promisePool
    .query('SELECT 1')
    .then(() => console.log('✅ MySQL connection pool ready.'))
    .catch(err => {
        console.error('❌ MySQL connection failed:', err.message);
        process.exit(1);
    });

module.exports = promisePool;
