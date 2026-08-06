const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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