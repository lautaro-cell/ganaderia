const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function resetDevDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('=== RESET DEV DATABASE ===\n');
    
    const countBefore = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM usuarios) as usuarios,
        (SELECT COUNT(*) FROM clientes) as clientes,
        (SELECT COUNT(*) FROM campos) as campos,
        (SELECT COUNT(*) FROM lotes) as lotes,
        (SELECT COUNT(*) FROM eventos) as eventos,
        (SELECT COUNT(*) FROM asientos) as asientos
    `);
    
    console.log('ANTES del reset:');
    console.log('  - Usuarios:', countBefore.rows[0].usuarios);
    console.log('  - Clientes:', countBefore.rows[0].clientes);
    console.log('  - Campos:', countBefore.rows[0].campos);
    console.log('  - Lotes:', countBefore.rows[0].lotes);
    console.log('  - Eventos:', countBefore.rows[0].eventos);
    console.log('  - Asientos:', countBefore.rows[0].asientos);
    console.log('');
    
    console.log('Ejecutando TRUNCATE...');
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE TABLE 
        sessions,
        auditor_clientes, 
        asientos, 
        eventos, 
        lotes_actividades,
        lotes, 
        campos, 
        usuarios, 
        clientes 
      RESTART IDENTITY CASCADE
    `);
    await client.query('COMMIT');
    console.log('TRUNCATE completado.\n');
    
    const countAfter = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM usuarios) as usuarios,
        (SELECT COUNT(*) FROM clientes) as clientes,
        (SELECT COUNT(*) FROM campos) as campos,
        (SELECT COUNT(*) FROM lotes) as lotes,
        (SELECT COUNT(*) FROM eventos) as eventos,
        (SELECT COUNT(*) FROM asientos) as asientos
    `);
    
    console.log('DESPUÉS del reset:');
    console.log('  - Usuarios:', countAfter.rows[0].usuarios);
    console.log('  - Clientes:', countAfter.rows[0].clientes);
    console.log('  - Campos:', countAfter.rows[0].campos);
    console.log('  - Lotes:', countAfter.rows[0].lotes);
    console.log('  - Eventos:', countAfter.rows[0].eventos);
    console.log('  - Asientos:', countAfter.rows[0].asientos);
    console.log('\n=== RESET COMPLETADO ===');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR durante reset:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

resetDevDatabase();
