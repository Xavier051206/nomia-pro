const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
});

// Esto es lo vital: exportar el pool directamente
module.exports = pool;
// Mensaje para confirmar que nos conectamos bien
pool.connect((err) => {
    if (err) {
        console.error('❌ Error conectando a la Base de Datos:', err.stack);
    } else {
        console.log('✅ Base de Datos conectada con éxito');
    }
});

module.exports = pool;