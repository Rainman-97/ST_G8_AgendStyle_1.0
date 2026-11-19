const express = require('express');

const { sql, getConnection } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

function getBogotaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function getBusinessId(req) {
  const businessId = Number(req.user?.negocioId);
  return Number.isInteger(businessId) && businessId > 0 ? businessId : null;
}

function validPersonName(value) {
  return /^[\p{L}\p{M} ]{2,80}$/u.test(String(value).trim());
}

function validColombianPhone(value) {
  return /^3\d{9}$/.test(String(value).replace(/\D/g, ''));
}

function validServiceName(value) {
  return /^[\p{L}\p{M} .&+/'-]{2,100}$/u.test(String(value).trim());
}

function validSpecialty(value) {
  return /^[\p{L}\p{M}0-9 .&+/'-]{2,80}$/u.test(String(value).trim());
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
  const fecha = req.query.fecha || getBogotaDate();

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

router.get('/recordatorios', async (req, res) => {
  const negocioId = getBusinessId(req);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.fecha || ''))
    ? String(req.query.fecha)
    : getBogotaDate();

  if (!negocioId) return res.status(403).json({ ok: false, message: 'El usuario no tiene un negocio asociado.' });

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .input('Fecha', sql.Date, fecha)
      .query(`
        SELECT COUNT(*) AS TotalCitas
        FROM dbo.Citas
        WHERE NegocioId = @NegocioId AND CAST(FechaHoraInicio AS DATE) = @Fecha AND Estado <> 'Cancelada';

        SELECT COUNT(*) AS CitasConfirmadas
        FROM dbo.Citas
        WHERE NegocioId = @NegocioId AND CAST(FechaHoraInicio AS DATE) = @Fecha AND Estado = 'Confirmada';

        SELECT COUNT(*) AS RecordatoriosEnviados
        FROM dbo.NotificacionesCitas AS n
        INNER JOIN dbo.Citas AS c ON c.CitaId = n.CitaId
        WHERE c.NegocioId = @NegocioId AND CAST(c.FechaHoraInicio AS DATE) = @Fecha
          AND CAST(n.CreadoEn AS DATE) = @Fecha AND n.Estado = 'Enviado';

        SELECT COUNT(*) AS CitasPendientes
        FROM dbo.Citas
        WHERE NegocioId = @NegocioId AND CAST(FechaHoraInicio AS DATE) = @Fecha AND Estado = 'Pendiente';

        SELECT TOP 5 n.NotificacionId, n.Canal, n.Estado, n.Proveedor, n.CreadoEn,
          CONCAT(cl.Nombres, ' ', cl.Apellidos) AS Cliente, s.Nombre AS Servicio
        FROM dbo.NotificacionesCitas AS n
        INNER JOIN dbo.Citas AS c ON c.CitaId = n.CitaId
        INNER JOIN dbo.Clientes AS cl ON cl.ClienteId = c.ClienteId
        INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
        WHERE c.NegocioId = @NegocioId AND CAST(n.CreadoEn AS DATE) = @Fecha
        ORDER BY n.CreadoEn DESC;
      `);

    const totalCitas = Number(result.recordsets[0][0]?.TotalCitas || 0);
    const confirmadas = Number(result.recordsets[1][0]?.CitasConfirmadas || 0);
    return res.json({
      ok: true,
      fecha,
      totalCitas,
      confirmadas,
      enviados: Number(result.recordsets[2][0]?.RecordatoriosEnviados || 0),
      pendientes: Number(result.recordsets[3][0]?.CitasPendientes || 0),
      porcentajeConfirmacion: totalCitas ? Math.round((confirmadas / totalCitas) * 100) : 0,
      ultimosEnvios: result.recordsets[4]
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cargar los recordatorios.', detail: error.message });
  }
});

router.get('/reportes', async (req, res) => {
  const negocioId = getBusinessId(req);
  const now = new Date();
  const defaultDesde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultHasta = getBogotaDate();
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.desde || '')) ? String(req.query.desde) : defaultDesde;
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.hasta || '')) ? String(req.query.hasta) : defaultHasta;

  if (!negocioId) return res.status(403).json({ ok: false, message: 'El usuario no tiene un negocio asociado.' });

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .input('Desde', sql.Date, desde)
      .input('Hasta', sql.Date, hasta)
      .query(`
        SELECT
          COUNT(*) AS TotalCitas,
          SUM(CASE WHEN c.Estado = 'Confirmada' THEN 1 ELSE 0 END) AS Confirmadas,
          SUM(CASE WHEN c.Estado = 'Cancelada' THEN 1 ELSE 0 END) AS Canceladas,
          SUM(CASE WHEN c.Estado = 'Atendida' THEN 1 ELSE 0 END) AS Atendidas,
          COALESCE(SUM(CASE WHEN c.Estado NOT IN ('Cancelada', 'No asistió') THEN s.Precio ELSE 0 END), 0) AS Ingresos
        FROM dbo.Citas AS c
        INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
        WHERE c.NegocioId = @NegocioId
          AND CAST(c.FechaHoraInicio AS DATE) BETWEEN @Desde AND @Hasta;

        SELECT CAST(c.FechaHoraInicio AS DATE) AS Fecha,
          COUNT(*) AS Citas,
          COALESCE(SUM(CASE WHEN c.Estado NOT IN ('Cancelada', 'No asistió') THEN s.Precio ELSE 0 END), 0) AS Ingresos
        FROM dbo.Citas AS c
        INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
        WHERE c.NegocioId = @NegocioId
          AND CAST(c.FechaHoraInicio AS DATE) BETWEEN @Desde AND @Hasta
        GROUP BY CAST(c.FechaHoraInicio AS DATE)
        ORDER BY Fecha;

        SELECT TOP 5 s.Nombre AS Servicio, COUNT(*) AS Citas,
          COALESCE(SUM(CASE WHEN c.Estado NOT IN ('Cancelada', 'No asistió') THEN s.Precio ELSE 0 END), 0) AS Ingresos
        FROM dbo.Citas AS c
        INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
        WHERE c.NegocioId = @NegocioId
          AND CAST(c.FechaHoraInicio AS DATE) BETWEEN @Desde AND @Hasta
        GROUP BY s.Nombre
        ORDER BY Citas DESC, Ingresos DESC;
      `);

    const resumen = result.recordsets[0][0] || {};
    return res.json({
      ok: true,
      desde,
      hasta,
      resumen: {
        totalCitas: Number(resumen.TotalCitas || 0),
        confirmadas: Number(resumen.Confirmadas || 0),
        canceladas: Number(resumen.Canceladas || 0),
        atendidas: Number(resumen.Atendidas || 0),
        ingresos: Number(resumen.Ingresos || 0)
      },
      porDia: result.recordsets[1],
      servicios: result.recordsets[2]
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible generar el reporte.', detail: error.message });
  }
});

router.get('/equipo', async (req, res) => {
  const negocioId = getBusinessId(req);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.fecha || ''))
    ? String(req.query.fecha)
    : getBogotaDate();
  if (!negocioId) return res.status(403).json({ ok: false, message: 'El usuario no tiene un negocio asociado.' });

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .input('Fecha', sql.Date, fecha)
      .query(`
        SELECT
          e.EstilistaId, e.Nombres, e.Apellidos, e.Especialidad, e.Telefono, e.Email, e.Activo,
          COALESCE(d.Estado, 'Disponible') AS EstadoDia,
          CASE
            WHEN COALESCE(d.Estado, 'Disponible') <> 'Disponible' THEN COALESCE(d.Estado, 'Disponible')
            WHEN EXISTS (
              SELECT 1
              FROM dbo.Citas AS c
              WHERE c.EstilistaId = e.EstilistaId
                AND c.NegocioId = @NegocioId
                AND CAST(c.FechaHoraInicio AS DATE) = @Fecha
                AND c.Estado NOT IN ('Cancelada', 'No asistió', 'Atendida')
                AND c.FechaHoraInicio <= DATEADD(HOUR, -5, SYSUTCDATETIME())
                AND c.FechaHoraFin > DATEADD(HOUR, -5, SYSUTCDATETIME())
          ) THEN 'Ocupado'
          ELSE 'Disponible'
          END AS EstadoActual
        FROM dbo.Estilistas AS e
        LEFT JOIN dbo.DisponibilidadEstilistas AS d
          ON d.EstilistaId = e.EstilistaId AND d.Fecha = @Fecha
        WHERE e.NegocioId = @NegocioId AND e.Activo = 1
        ORDER BY e.Apellidos, e.Nombres;
      `);
    return res.json({ ok: true, fecha, equipo: result.recordset });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cargar el equipo.', detail: error.message });
  }
});

router.patch('/equipo/:id/disponibilidad', requireAdministrator, async (req, res) => {
  const negocioId = getBusinessId(req);
  const estilistaId = Number(req.params.id);
  const fecha = String(req.body.fecha || '').trim();
  const estado = String(req.body.estado || '').trim();
  const estadosPermitidos = ['Disponible', 'Descanso', 'No trabaja'];

  if (!negocioId || !estilistaId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !estadosPermitidos.includes(estado)) {
    return res.status(400).json({ ok: false, message: 'La disponibilidad indicada no es válida.' });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .input('EstilistaId', sql.Int, estilistaId)
      .input('Fecha', sql.Date, fecha)
      .input('Estado', sql.VarChar(20), estado)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.Estilistas WHERE EstilistaId = @EstilistaId AND NegocioId = @NegocioId AND Activo = 1)
            THROW 51000, 'El miembro del equipo no pertenece al negocio.', 1;

        MERGE dbo.DisponibilidadEstilistas AS destino
        USING (SELECT @EstilistaId AS EstilistaId, @Fecha AS Fecha) AS origen
          ON destino.EstilistaId = origen.EstilistaId AND destino.Fecha = origen.Fecha
        WHEN MATCHED THEN
          UPDATE SET Estado = @Estado, FechaActualizacion = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (EstilistaId, Fecha, Estado) VALUES (@EstilistaId, @Fecha, @Estado);

        SELECT @EstilistaId AS EstilistaId, @Fecha AS Fecha, @Estado AS Estado;
      `);
    return res.json({ ok: true, disponibilidad: result.recordset[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar la disponibilidad.', detail: error.message });
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
  if (!validPersonName(nombres) || !validPersonName(apellidos)) {
    return res.status(400).json({ ok: false, message: 'Nombres y apellidos solo pueden contener letras y espacios.' });
  }
  if (!validColombianPhone(telefono)) {
    return res.status(400).json({ ok: false, message: 'El teléfono debe tener 10 dígitos y comenzar por 3.' });
  }
  if (email && !/^[^\s@]+@gmail\.com$/i.test(email)) {
    return res.status(400).json({ ok: false, message: 'El correo debe terminar en @gmail.com.' });
  }
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
  if (!validServiceName(nombre)) {
    return res.status(400).json({ ok: false, message: 'El nombre del servicio contiene caracteres no válidos.' });
  }
  if (descripcion && descripcion.length > 250) {
    return res.status(400).json({ ok: false, message: 'La descripción no puede superar 250 caracteres.' });
  }
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
  if (!validSpecialty(especialidad)) {
    return res.status(400).json({ ok: false, message: 'La especialidad contiene caracteres no válidos.' });
  }
  if (!validPersonName(nombres) || !validPersonName(apellidos)) {
    return res.status(400).json({ ok: false, message: 'Nombres y apellidos solo pueden contener letras y espacios.' });
  }
  if (telefono && !validColombianPhone(telefono)) {
    return res.status(400).json({ ok: false, message: 'El teléfono debe tener 10 dígitos y comenzar por 3.' });
  }
  if (email && !/^[^\s@]+@gmail\.com$/i.test(email)) {
    return res.status(400).json({ ok: false, message: 'El correo debe terminar en @gmail.com.' });
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
