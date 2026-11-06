const express = require('express');

const { sql, getConnection } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

function getBusinessId(req) {
  const businessId = Number(req.user?.negocioId);
  return Number.isInteger(businessId) && businessId > 0 ? businessId : null;
}

function requireAdministrator(req, res, next) {
  if (req.user?.rol !== 'Administrador') {
    return res.status(403).json({ ok: false, message: 'Solo el administrador puede gestionar los datos del negocio.' });
  }
  next();
}

router.use(authenticateToken);

router.get('/resumen', async (req, res) => {
  const negocioId = getBusinessId(req);
  const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);

  if (!negocioId) return res.status(403).json({ ok: false, message: 'El usuario no tiene un negocio asociado.' });

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .input('Fecha', sql.Date, fecha)
      .query(`
        SELECT COUNT(*) AS CitasHoy
        FROM dbo.Citas
        WHERE NegocioId = @NegocioId
          AND CAST(FechaHoraInicio AS DATE) = @Fecha
          AND Estado <> 'Cancelada';

        SELECT COALESCE(SUM(s.Precio), 0) AS IngresosEstimados
        FROM dbo.Citas AS c
        INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
        WHERE c.NegocioId = @NegocioId
          AND CAST(c.FechaHoraInicio AS DATE) = @Fecha
          AND c.Estado NOT IN ('Cancelada', 'No asistió');

        SELECT TOP 1
          c.CitaId, c.FechaHoraInicio, c.FechaHoraFin, c.Estado,
          CONCAT(cl.Nombres, ' ', cl.Apellidos) AS Cliente,
          s.Nombre AS Servicio
        FROM dbo.Citas AS c
        INNER JOIN dbo.Clientes AS cl ON cl.ClienteId = c.ClienteId
        INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
        WHERE c.NegocioId = @NegocioId
          AND CAST(c.FechaHoraInicio AS DATE) = @Fecha
          AND c.Estado NOT IN ('Cancelada', 'No asistió')
          AND c.FechaHoraInicio >= SYSDATETIME()
        ORDER BY c.FechaHoraInicio;

        SELECT COUNT(*) AS ClientesRegistrados
        FROM dbo.Clientes
        WHERE NegocioId = @NegocioId AND Activo = 1;

        SELECT DISTINCT CAST(FechaHoraInicio AS DATE) AS Fecha
        FROM dbo.Citas
        WHERE NegocioId = @NegocioId
          AND Estado <> 'Cancelada'
          AND FechaHoraInicio >= DATEADD(DAY, -31, CAST(@Fecha AS DATETIME2))
          AND FechaHoraInicio < DATEADD(DAY, 32, CAST(@Fecha AS DATETIME2))
        ORDER BY Fecha;
      `);

    return res.json({
      ok: true,
      fecha,
      citasHoy: result.recordsets[0][0]?.CitasHoy || 0,
      ingresosEstimados: result.recordsets[1][0]?.IngresosEstimados || 0,
      proximaCita: result.recordsets[2][0] || null,
      clientesRegistrados: result.recordsets[3][0]?.ClientesRegistrados || 0,
      fechasConCitas: result.recordsets[4].map((row) => row.Fecha)
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cargar el resumen del negocio.', detail: error.message });
  }
});

router.get('/equipo', async (req, res) => {
  const negocioId = getBusinessId(req);
  if (!negocioId) return res.status(403).json({ ok: false, message: 'El usuario no tiene un negocio asociado.' });

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .query(`
        SELECT EstilistaId, Nombres, Apellidos, Especialidad, Telefono, Email, Activo
        FROM dbo.Estilistas
        WHERE NegocioId = @NegocioId AND Activo = 1
        ORDER BY Apellidos, Nombres;
      `);
    return res.json({ ok: true, equipo: result.recordset });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cargar el equipo.', detail: error.message });
  }
});

router.get('/clientes', async (req, res) => {
  const negocioId = getBusinessId(req);
  if (!negocioId) return res.status(403).json({ ok: false, message: 'El usuario no tiene un negocio asociado.' });
  try {
    const pool = await getConnection();
    const result = await pool.request().input('NegocioId', sql.Int, negocioId).query(`
      SELECT ClienteId, Nombres, Apellidos, Telefono, Email, FechaRegistro
      FROM dbo.Clientes WHERE NegocioId = @NegocioId AND Activo = 1
      ORDER BY Apellidos, Nombres;
    `);
    return res.json({ ok: true, clientes: result.recordset });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cargar los clientes.', detail: error.message });
  }
});

router.post('/clientes', requireAdministrator, async (req, res) => {
  const negocioId = getBusinessId(req);
  const nombres = String(req.body.nombres || '').trim();
  const apellidos = String(req.body.apellidos || '').trim();
  const telefono = String(req.body.telefono || '').trim();
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
  if (!negocioId || !nombres || !apellidos || !telefono) {
    return res.status(400).json({ ok: false, message: 'Nombres, apellidos y teléfono son obligatorios.' });
  }
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId).input('Nombres', sql.NVarChar(80), nombres)
      .input('Apellidos', sql.NVarChar(80), apellidos).input('Telefono', sql.VarChar(20), telefono)
      .input('Email', sql.VarChar(150), email)
      .query(`INSERT INTO dbo.Clientes (NegocioId, Nombres, Apellidos, Telefono, Email)
        OUTPUT INSERTED.ClienteId, INSERTED.Nombres, INSERTED.Apellidos, INSERTED.Telefono, INSERTED.Email
        VALUES (@NegocioId, @Nombres, @Apellidos, @Telefono, @Email);`);
    return res.status(201).json({ ok: true, message: 'Cliente agregado correctamente.', cliente: result.recordset[0] });
  } catch (error) {
    return res.status(error.number === 2601 || error.number === 2627 ? 409 : 500).json({ ok: false, message: error.number === 2601 || error.number === 2627 ? 'Ya existe un cliente con ese correo en este negocio.' : 'No fue posible agregar el cliente.', detail: error.message });
  }
});

router.post('/servicios', requireAdministrator, async (req, res) => {
  const negocioId = getBusinessId(req);
  const nombre = String(req.body.nombre || '').trim();
  const descripcion = req.body.descripcion ? String(req.body.descripcion).trim() : null;
  const duracionMinutos = Number(req.body.duracionMinutos);
  const precio = Number(req.body.precio);
  if (!negocioId || !nombre || !Number.isInteger(duracionMinutos) || duracionMinutos <= 0 || !Number.isFinite(precio) || precio < 0) {
    return res.status(400).json({ ok: false, message: 'Nombre, duración y precio válido son obligatorios.' });
  }
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId).input('Nombre', sql.NVarChar(100), nombre)
      .input('Descripcion', sql.NVarChar(250), descripcion).input('DuracionMinutos', sql.SmallInt, duracionMinutos)
      .input('Precio', sql.Decimal(10, 2), precio)
      .query(`INSERT INTO dbo.Servicios (NegocioId, Nombre, Descripcion, DuracionMinutos, Precio)
        OUTPUT INSERTED.ServicioId, INSERTED.Nombre, INSERTED.DuracionMinutos, INSERTED.Precio
        VALUES (@NegocioId, @Nombre, @Descripcion, @DuracionMinutos, @Precio);`);
    return res.status(201).json({ ok: true, message: 'Servicio agregado correctamente.', servicio: result.recordset[0] });
  } catch (error) {
    return res.status(error.number === 2601 || error.number === 2627 ? 409 : 500).json({ ok: false, message: error.number === 2601 || error.number === 2627 ? 'Ya existe un servicio con ese nombre.' : 'No fue posible agregar el servicio.', detail: error.message });
  }
});

router.post('/equipo', requireAdministrator, async (req, res) => {
  const negocioId = getBusinessId(req);
  const nombres = String(req.body.nombres || '').trim();
  const apellidos = String(req.body.apellidos || '').trim();
  const especialidad = String(req.body.especialidad || '').trim();
  const telefono = req.body.telefono ? String(req.body.telefono).trim() : null;
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;

  if (!negocioId || !nombres || !apellidos || !especialidad) {
    return res.status(400).json({ ok: false, message: 'Nombres, apellidos y especialidad son obligatorios.' });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .input('Nombres', sql.NVarChar(80), nombres)
      .input('Apellidos', sql.NVarChar(80), apellidos)
      .input('Especialidad', sql.NVarChar(80), especialidad)
      .input('Telefono', sql.VarChar(20), telefono)
      .input('Email', sql.VarChar(150), email)
      .query(`
        INSERT INTO dbo.Estilistas (NegocioId, Nombres, Apellidos, Especialidad, Telefono, Email)
        OUTPUT INSERTED.EstilistaId, INSERTED.Nombres, INSERTED.Apellidos, INSERTED.Especialidad, INSERTED.Telefono, INSERTED.Email
        VALUES (@NegocioId, @Nombres, @Apellidos, @Especialidad, @Telefono, @Email);
      `);
    return res.status(201).json({ ok: true, message: 'Miembro del equipo agregado correctamente.', miembro: result.recordset[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible agregar el miembro del equipo.', detail: error.message });
  }
});

module.exports = router;
