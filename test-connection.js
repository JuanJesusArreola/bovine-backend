const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bovino_ujat_db',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '2003',
});

async function testConnection() {
  try {
    console.log('🔍 Probando conexión a PostgreSQL...');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Puerto: ${process.env.DB_PORT}`);
    console.log(`Base de datos: ${process.env.DB_NAME}`);
    console.log(`Usuario: ${process.env.DB_USERNAME}`);
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    
    console.log('✅ ¡Conexión exitosa!');
    console.log('📅 Hora del servidor:', result.rows[0].now);
    
    client.release();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    process.exit(1);
  }
}

testConnection();