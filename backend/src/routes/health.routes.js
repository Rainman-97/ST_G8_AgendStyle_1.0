const express = require('express');
const { getConnection } = require('../config/database');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT DB_NAME() AS databaseName, SYSDATETIME() AS serverTime');

    res.json({
      ok: true,
      service: 'AgendaStyle API',
      database: result.recordset[0]
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: 'AgendaStyle API',
      message: 'No fue posible conectar con SQL Server.',
      detail: error.message
    });
  }
});

module.exports = router;
