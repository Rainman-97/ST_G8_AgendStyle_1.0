const fs = require('node:fs');
const path = require('node:path');
const { getConnection } = require('../src/config/database');

const migrationFiles = [
  '02_Usuarios_Auth.sql',
  '03_Negocios_Propietarios.sql'
];

async function runMigrations() {
  const pool = await getConnection();

  for (const fileName of migrationFiles) {
    const filePath = path.join(__dirname, '..', '..', 'database', fileName);
    const sqlScript = fs.readFileSync(filePath, 'utf8');
    const batches = sqlScript.split(/^\s*GO\s*$/gim).filter((batch) => batch.trim());

    console.log(`Ejecutando ${fileName}...`);
    for (const batch of batches) {
      await pool.request().batch(batch);
    }
    console.log(`${fileName} ejecutado correctamente.`);
  }

  const result = await pool.request().query(`
    SELECT TABLE_NAME AS tableName
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);

  console.table(result.recordset);
  await pool.close();
}

runMigrations().catch((error) => {
  console.error('No fue posible ejecutar las migraciones:', error.message);
  process.exitCode = 1;
});
