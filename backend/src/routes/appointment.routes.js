const express = require('express');

const { sql, getConnection } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function validPersonName(value) {
  return /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü ]{2,80}$/.test(String(value).trim());
}

function validColombianPhone(value) {
  return /^3\d{9}$/.test(String(value).replace(/\D/g, ''));
}

function parseDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getBusinessId(req) {
  const businessId = Number(req.user?.negocioId);
  return Number.isInteger(businessId) && businessId > 0 ? businessId : null;
}

router.get('/catalogos', authenticateToken, async (_req, res) => {
  const negocioId = getBusinessId(_req);
  if (!negocioId) return res.status(403).json({ ok: false, message: 'El usuario no tiene un negocio asociado.' });

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .query(`
      SELECT ClienteId, Nombres, Apellidos, Telefono
      FROM dbo.Clientes
      WHERE Activo = 1 AND NegocioId = @NegocioId
      ORDER BY Apellidos, Nombres;

      SELECT EstilistaId, Nombres, Apellidos, Especialidad
      FROM dbo.Estilistas
      WHERE Activo = 1 AND NegocioId = @NegocioId
      ORDER BY Apellidos, Nombres;

      SELECT ServicioId, Nombre, DuracionMinutos, Precio
      FROM dbo.Servicios
      WHERE Activo = 1 AND NegocioId = @NegocioId
      ORDER BY Nombre;
    `);

    return res.json({
      ok: true,
      clientes: result.recordsets[0],
      estilistas: result.recordsets[1],
      servicios: result.recordsets[2]
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cargar los datos de la agenda.', detail: error.message });
  }
});

/* Catálogos que puede consultar un cliente antes de reservar. */
router.get('/catalogos-publicos', async (req, res) => {
  const negocioId = Number(req.query.negocioId);

  if (!Number.isInteger(negocioId) || negocioId < 1) {
    return res.status(400).json({ ok: false, message: 'Debes indicar un negocio válido.' });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .query(`
        SELECT NegocioId, NombreComercial, TipoNegocio
        FROM dbo.Negocios
        WHERE NegocioId = @NegocioId AND Activo = 1;

        SELECT EstilistaId, Nombres, Apellidos, Especialidad
        FROM dbo.Estilistas
        WHERE Activo = 1 AND NegocioId = @NegocioId
        ORDER BY Apellidos, Nombres;

        SELECT ServicioId, Nombre, DuracionMinutos, Precio
        FROM dbo.Servicios
        WHERE Activo = 1 AND NegocioId = @NegocioId
        ORDER BY Nombre;
      `);

    if (result.recordsets[0].length === 0) {
      return res.status(404).json({ ok: false, message: 'El negocio no existe o está inactivo.' });
    }

    return res.json({
      ok: true,
      negocio: result.recordsets[0][0],
      estilistas: result.recordsets[1],
      servicios: result.recordsets[2]
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cargar la información pública.', detail: error.message });
  }
});

router.get('/negocios-publicos', async (_req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT NegocioId, NombreComercial, TipoNegocio
      FROM dbo.Negocios
      WHERE Activo = 1
      ORDER BY NombreComercial;
    `);
    return res.json({ ok: true, negocios: result.recordset });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cargar los negocios.', detail: error.message });
  }
});

router.get('/proximas', authenticateToken, async (req, res) => {
  const negocioId = getBusinessId(req);
  const limite = Math.min(Math.max(Number(req.query.limite) || 5, 1), 20);
  const periodo = ['dia', 'semana', 'mes'].includes(String(req.query.periodo)) ? String(req.query.periodo) : 'dia';
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.fecha || ''))
    ? String(req.query.fecha)
    : new Date().toISOString().slice(0, 10);

  if (!negocioId) {
    return res.status(403).json({ ok: false, message: 'El usuario no tiene un negocio asociado.' });
  }

  try {
    const pool = await getConnection();
    const rangeCondition = periodo === 'dia'
      ? 'CAST(c.FechaHoraInicio AS DATE) = @Fecha'
      : periodo === 'semana'
        ? `c.FechaHoraInicio >= DATEADD(DAY, ((DAY(@Fecha) - 1) / 7) * 7,
             DATEFROMPARTS(YEAR(@Fecha), MONTH(@Fecha), 1))
           AND c.FechaHoraInicio < DATEADD(DAY, ((DAY(@Fecha) - 1) / 7 + 1) * 7,
             DATEFROMPARTS(YEAR(@Fecha), MONTH(@Fecha), 1))`
        : `c.FechaHoraInicio >= DATEFROMPARTS(YEAR(@Fecha), MONTH(@Fecha), 1)
           AND c.FechaHoraInicio < DATEADD(MONTH, 1,
             DATEFROMPARTS(YEAR(@Fecha), MONTH(@Fecha), 1))`;

    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .input('Limite', sql.Int, limite)
      .input('Fecha', sql.Date, fecha)
      .query(`
        SELECT TOP (@Limite)
          c.CitaId, c.FechaHoraInicio, c.FechaHoraFin, c.Estado, c.Observaciones,
          c.MotivoCancelacion, c.DescripcionCancelacion, c.SolucionCancelacion, c.FechaCancelacion,
          CONCAT(cl.Nombres, ' ', cl.Apellidos) AS Cliente,
          CONCAT(e.Nombres, ' ', e.Apellidos) AS Estilista,
          s.Nombre AS Servicio
        FROM dbo.Citas AS c
        INNER JOIN dbo.Clientes AS cl ON cl.ClienteId = c.ClienteId
        INNER JOIN dbo.Estilistas AS e ON e.EstilistaId = c.EstilistaId
        INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
        WHERE c.NegocioId = @NegocioId
          AND c.Estado <> 'Cancelada'
          AND ${rangeCondition}
        ORDER BY c.FechaHoraInicio;
      `);

    return res.json({ ok: true, periodo, fecha, citas: result.recordset });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cargar las próximas citas.', detail: error.message });
  }
});

router.get('/historial', authenticateToken, async (req, res) => {
  const negocioId = getBusinessId(req);
  const limite = Math.min(Math.max(Number(req.query.limite) || 100, 1), 500);

  if (!negocioId) {
    return res.status(403).json({ ok: false, message: 'El usuario no tiene un negocio asociado.' });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .input('Limite', sql.Int, limite)
      .query(`
        SELECT TOP (@Limite)
          c.CitaId, c.FechaHoraInicio, c.FechaHoraFin, c.Estado, c.Observaciones,
          c.MotivoCancelacion, c.DescripcionCancelacion, c.SolucionCancelacion, c.FechaCancelacion,
          CONCAT(cl.Nombres, ' ', cl.Apellidos) AS Cliente,
          CONCAT(e.Nombres, ' ', e.Apellidos) AS Estilista,
          s.Nombre AS Servicio,
          s.Precio
        FROM dbo.Citas AS c
        INNER JOIN dbo.Clientes AS cl ON cl.ClienteId = c.ClienteId
        INNER JOIN dbo.Estilistas AS e ON e.EstilistaId = c.EstilistaId
        INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
        WHERE c.NegocioId = @NegocioId
        ORDER BY c.FechaHoraInicio DESC;
      `);

    return res.json({ ok: true, citas: result.recordset });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cargar el historial de citas.', detail: error.message });
  }
});

router.get('/pendientes', authenticateToken, async (req, res) => {
  const negocioId = getBusinessId(req);

  if (!negocioId) {
    return res.status(403).json({ ok: false, message: 'El usuario no tiene un negocio asociado.' });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .query(`
        SELECT c.CitaId, c.FechaHoraInicio, c.FechaHoraFin, c.Estado,
          CONCAT(cl.Nombres, ' ', cl.Apellidos) AS Cliente,
          cl.Telefono, cl.Email, s.Nombre AS Servicio
        FROM dbo.Citas AS c
        INNER JOIN dbo.Clientes AS cl ON cl.ClienteId = c.ClienteId
        INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
        WHERE c.NegocioId = @NegocioId AND c.Estado = 'Pendiente'
        ORDER BY c.FechaHoraInicio;
      `);

    return res.json({ ok: true, citas: result.recordset });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cargar las citas pendientes.', detail: error.message });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  const negocioId = getBusinessId(req);
  const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);

  if (!negocioId) {
    return res.status(403).json({ ok: false, message: 'El usuario no tiene un negocio asociado.' });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('NegocioId', sql.Int, negocioId)
      .input('Fecha', sql.Date, fecha)
      .query(`
        SELECT
          c.CitaId,
          c.FechaHoraInicio,
          c.FechaHoraFin,
          c.Estado,
          c.Observaciones,
          CONCAT(cl.Nombres, ' ', cl.Apellidos) AS Cliente,
          cl.Telefono AS ClienteTelefono,
          CONCAT(e.Nombres, ' ', e.Apellidos) AS Estilista,
          s.Nombre AS Servicio,
          s.Precio,
          r.RecordatorioId,
          r.Estado AS EstadoRecordatorio
        FROM dbo.Citas AS c
        INNER JOIN dbo.Clientes AS cl ON cl.ClienteId = c.ClienteId
        INNER JOIN dbo.Estilistas AS e ON e.EstilistaId = c.EstilistaId
        INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
        LEFT JOIN dbo.Recordatorios AS r ON r.CitaId = c.CitaId AND r.Tipo = 'WhatsApp'
        WHERE c.NegocioId = @NegocioId
          AND CAST(c.FechaHoraInicio AS DATE) = @Fecha
        ORDER BY c.FechaHoraInicio
      `);

    return res.json({ ok: true, fecha, citas: result.recordset });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible consultar la agenda.', detail: error.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const negocioId = getBusinessId(req);
  const clienteId = Number(req.body.clienteId);
  const estilistaId = Number(req.body.estilistaId);
  const servicioId = Number(req.body.servicioId);
  const inicio = parseDateTime(req.body.fechaHoraInicio);
  const observaciones = req.body.observaciones ? String(req.body.observaciones).trim() : null;

  if (!negocioId || !clienteId || !estilistaId || !servicioId || !inicio) {
    return res.status(400).json({ ok: false, message: 'Cliente, estilista, servicio y fecha de inicio son obligatorios.' });
  }

  try {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      const serviceResult = await new sql.Request(transaction)
        .input('ServicioId', sql.Int, servicioId)
        .input('NegocioId', sql.Int, negocioId)
        .query(`SELECT ServicioId, DuracionMinutos FROM dbo.Servicios WHERE ServicioId = @ServicioId AND NegocioId = @NegocioId AND Activo = 1`);

      const service = serviceResult.recordset[0];
      if (!service) {
        await transaction.rollback();
        return res.status(404).json({ ok: false, message: 'El servicio no existe o está inactivo.' });
      }

      const end = new Date(inicio.getTime() + service.DuracionMinutos * 60000);
      const request = new sql.Request(transaction);
      request.input('NegocioId', sql.Int, negocioId);
      request.input('ClienteId', sql.Int, clienteId);
      request.input('EstilistaId', sql.Int, estilistaId);
      request.input('ServicioId', sql.Int, servicioId);
      request.input('Inicio', sql.DateTime2(0), inicio);
      request.input('Fin', sql.DateTime2(0), end);
      request.input('Observaciones', sql.NVarChar(300), observaciones);

      const entities = await new sql.Request(transaction)
        .input('NegocioId', sql.Int, negocioId)
        .input('ClienteId', sql.Int, clienteId)
        .input('EstilistaId', sql.Int, estilistaId)
        .query(`
          SELECT
            (SELECT COUNT(*) FROM dbo.Clientes WHERE ClienteId = @ClienteId AND NegocioId = @NegocioId AND Activo = 1) AS ClienteValido,
            (SELECT COUNT(*) FROM dbo.Estilistas WHERE EstilistaId = @EstilistaId AND NegocioId = @NegocioId AND Activo = 1) AS EstilistaValido;
        `);
      const entityState = entities.recordset[0];
      if (!entityState.ClienteValido || !entityState.EstilistaValido) {
        await transaction.rollback();
        return res.status(400).json({ ok: false, message: 'El cliente o el estilista no pertenece a este negocio.' });
      }

      const availability = await request.query(`
        SELECT TOP 1 c.CitaId
        FROM dbo.Citas AS c WITH (UPDLOCK, HOLDLOCK)
        WHERE c.NegocioId = @NegocioId
          AND c.EstilistaId = @EstilistaId
          AND c.Estado NOT IN ('Cancelada', 'No asistió')
          AND @Inicio < c.FechaHoraFin
          AND @Fin > c.FechaHoraInicio
      `);

      if (availability.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({ ok: false, message: 'El estilista ya tiene una cita en ese horario.' });
      }

      const appointmentResult = await new sql.Request(transaction)
        .input('NegocioId', sql.Int, negocioId)
        .input('ClienteId', sql.Int, clienteId)
        .input('EstilistaId', sql.Int, estilistaId)
        .input('ServicioId', sql.Int, servicioId)
        .input('Inicio', sql.DateTime2(0), inicio)
        .input('Fin', sql.DateTime2(0), end)
        .input('Observaciones', sql.NVarChar(300), observaciones)
        .query(`
          DECLARE @NuevaCita TABLE
          (
            CitaId INT,
            FechaHoraInicio DATETIME2(0),
            FechaHoraFin DATETIME2(0),
            Estado VARCHAR(20)
          );

          INSERT INTO dbo.Citas (NegocioId, ClienteId, EstilistaId, ServicioId, FechaHoraInicio, FechaHoraFin, Estado, Observaciones)
          OUTPUT INSERTED.CitaId, INSERTED.FechaHoraInicio, INSERTED.FechaHoraFin, INSERTED.Estado
          INTO @NuevaCita (CitaId, FechaHoraInicio, FechaHoraFin, Estado)
          VALUES (@NegocioId, @ClienteId, @EstilistaId, @ServicioId, @Inicio, @Fin, 'Pendiente', @Observaciones);

          SELECT CitaId, FechaHoraInicio, FechaHoraFin, Estado FROM @NuevaCita;
        `);

      const appointment = appointmentResult.recordset[0];
      const reminderDate = new Date(inicio.getTime() - 24 * 60 * 60000);

      await new sql.Request(transaction)
        .input('CitaId', sql.Int, appointment.CitaId)
        .input('ProgramadoPara', sql.DateTime2(0), reminderDate)
        .query(`
          INSERT INTO dbo.Recordatorios (CitaId, Tipo, ProgramadoPara, Estado)
          VALUES (@CitaId, 'WhatsApp', @ProgramadoPara, 'Pendiente')
        `);

      await transaction.commit();
      return res.status(201).json({ ok: true, message: 'Cita creada correctamente.', cita: appointment });
    } catch (transactionError) {
      // El trigger de disponibilidad puede haber hecho rollback previamente.
      // Conservamos el error original si la transacción ya está cerrada.
      try {
        await transaction.rollback();
      } catch (_rollbackError) {
        // La transacción ya estaba revertida o cerrada.
      }
      throw transactionError;
    }
  } catch (error) {
    const errorMessage = String(error.message || '');
    const isConflict = error.number === 2601 || error.number === 2627 || error.number === 50000;
    const isScheduleConflict = errorMessage.toLowerCase().includes('ya tiene una cita') || errorMessage.toLowerCase().includes('cruce');

    return res.status(isConflict || isScheduleConflict ? 409 : 500).json({
      ok: false,
      message: isConflict || isScheduleConflict
        ? 'El estilista ya tiene una cita en ese horario.'
        : 'No fue posible crear la cita.',
      detail: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});

/* Reserva pública: un cliente puede agendar sin entrar al panel administrativo. */
router.post('/reservar', async (req, res) => {
  const negocioId = Number(req.body.negocioId);
  const estilistaId = Number(req.body.estilistaId);
  const servicioId = Number(req.body.servicioId);
  const inicio = parseDateTime(req.body.fechaHoraInicio);
  const nombres = String(req.body.nombres || '').trim();
  const apellidos = String(req.body.apellidos || '').trim();
  const telefono = String(req.body.telefono || '').trim();
  const email = normalizeEmail(req.body.email);
  const observaciones = req.body.observaciones ? String(req.body.observaciones).trim() : null;

  if (!negocioId || !estilistaId || !servicioId || !inicio || !nombres || !apellidos || !telefono || !email) {
    return res.status(400).json({ ok: false, message: 'Completa tus datos y selecciona servicio, estilista, fecha y hora.' });
  }

  if (!validPersonName(nombres) || !validPersonName(apellidos)) {
    return res.status(400).json({ ok: false, message: 'Nombres y apellidos solo pueden contener letras y espacios.' });
  }
  if (!validColombianPhone(telefono)) {
    return res.status(400).json({ ok: false, message: 'El teléfono debe tener exactamente 10 dígitos y comenzar por 3.' });
  }
  if (!/^[^\s@]+@gmail\.com$/i.test(email)) {
    return res.status(400).json({ ok: false, message: 'El correo debe terminar en @gmail.com.' });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (inicio < today) {
    return res.status(400).json({ ok: false, message: 'La fecha de la cita debe ser hoy o una fecha futura.' });
  }

  try {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      const serviceResult = await new sql.Request(transaction)
        .input('ServicioId', sql.Int, servicioId)
        .input('NegocioId', sql.Int, negocioId)
        .query('SELECT ServicioId, DuracionMinutos FROM dbo.Servicios WHERE ServicioId = @ServicioId AND NegocioId = @NegocioId AND Activo = 1');
      const service = serviceResult.recordset[0];

      if (!service) {
        await transaction.rollback();
        return res.status(404).json({ ok: false, message: 'El servicio no existe o está inactivo.' });
      }

      const end = new Date(inicio.getTime() + service.DuracionMinutos * 60000);
      const existingClient = await new sql.Request(transaction)
        .input('Email', sql.VarChar(150), email)
        .input('NegocioId', sql.Int, negocioId)
        .query('SELECT TOP 1 ClienteId FROM dbo.Clientes WITH (UPDLOCK, HOLDLOCK) WHERE Email = @Email AND NegocioId = @NegocioId');

      let clienteId = existingClient.recordset[0]?.ClienteId;
      if (!clienteId) {
        const clientResult = await new sql.Request(transaction)
          .input('NegocioId', sql.Int, negocioId)
          .input('Nombres', sql.NVarChar(80), nombres)
          .input('Apellidos', sql.NVarChar(80), apellidos)
          .input('Telefono', sql.VarChar(20), telefono)
          .input('Email', sql.VarChar(150), email)
          .query(`
            INSERT INTO dbo.Clientes (NegocioId, Nombres, Apellidos, Telefono, Email)
            OUTPUT INSERTED.ClienteId
            VALUES (@NegocioId, @Nombres, @Apellidos, @Telefono, @Email)
          `);
        clienteId = clientResult.recordset[0].ClienteId;
      }

      const available = await new sql.Request(transaction)
        .input('NegocioId', sql.Int, negocioId)
        .input('EstilistaId', sql.Int, estilistaId)
        .input('Inicio', sql.DateTime2(0), inicio)
        .input('Fin', sql.DateTime2(0), end)
        .query(`
          SELECT TOP 1 CitaId
          FROM dbo.Citas WITH (UPDLOCK, HOLDLOCK)
          WHERE NegocioId = @NegocioId
            AND EstilistaId = @EstilistaId
            AND Estado NOT IN ('Cancelada', 'No asistió')
            AND @Inicio < FechaHoraFin
            AND @Fin > FechaHoraInicio
        `);

      if (available.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({ ok: false, message: 'Ese horario ya no está disponible. Selecciona otro.' });
      }

      const appointmentResult = await new sql.Request(transaction)
        .input('NegocioId', sql.Int, negocioId)
        .input('ClienteId', sql.Int, clienteId)
        .input('EstilistaId', sql.Int, estilistaId)
        .input('ServicioId', sql.Int, servicioId)
        .input('Inicio', sql.DateTime2(0), inicio)
        .input('Fin', sql.DateTime2(0), end)
        .input('Observaciones', sql.NVarChar(300), observaciones)
        .query(`
          DECLARE @NuevaCita TABLE
          (
            CitaId INT,
            FechaHoraInicio DATETIME2(0),
            FechaHoraFin DATETIME2(0),
            Estado VARCHAR(20)
          );

          INSERT INTO dbo.Citas (NegocioId, ClienteId, EstilistaId, ServicioId, FechaHoraInicio, FechaHoraFin, Estado, Observaciones)
          OUTPUT INSERTED.CitaId, INSERTED.FechaHoraInicio, INSERTED.FechaHoraFin, INSERTED.Estado
          INTO @NuevaCita (CitaId, FechaHoraInicio, FechaHoraFin, Estado)
          VALUES (@NegocioId, @ClienteId, @EstilistaId, @ServicioId, @Inicio, @Fin, 'Pendiente', @Observaciones);

          SELECT CitaId, FechaHoraInicio, FechaHoraFin, Estado FROM @NuevaCita;
        `);

      const appointment = appointmentResult.recordset[0];
      await new sql.Request(transaction)
        .input('CitaId', sql.Int, appointment.CitaId)
        .input('ProgramadoPara', sql.DateTime2(0), new Date(inicio.getTime() - 24 * 60 * 60000))
        .query(`
          INSERT INTO dbo.Recordatorios (CitaId, Tipo, ProgramadoPara, Estado)
          VALUES (@CitaId, 'WhatsApp', @ProgramadoPara, 'Pendiente')
        `);

      await transaction.commit();
      return res.status(201).json({ ok: true, message: 'Solicitud de cita creada correctamente.', cita: appointment });
    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible crear la solicitud de cita.', detail: error.message });
  }
});

router.patch('/:id/cancelar', authenticateToken, async (req, res) => {
  const negocioId = getBusinessId(req);
  const citaId = Number(req.params.id);
  const motivo = String(req.body.motivo || '').trim();
  const descripcion = String(req.body.descripcion || '').trim();
  const solucion = String(req.body.solucion || '').trim();
  const motivosPermitidos = ['Cliente solicitó cancelación', 'Negocio no disponible', 'Reprogramación', 'Datos incorrectos', 'No asistencia', 'Otro'];
  const solucionesPermitidas = ['Reprogramar cita', 'Contactar al cliente', 'Liberar horario', 'Sin solución'];

  if (!negocioId || !citaId || !motivosPermitidos.includes(motivo) || descripcion.length < 10 || !solucionesPermitidas.includes(solucion)) {
    return res.status(400).json({ ok: false, message: 'La cita indicada no es válida.' });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('CitaId', sql.Int, citaId)
      .input('NegocioId', sql.Int, negocioId)
      .input('Motivo', sql.NVarChar(100), motivo)
      .input('Descripcion', sql.NVarChar(500), descripcion)
      .input('Solucion', sql.NVarChar(200), solucion)
      .query(`
        DECLARE @CitaActualizada TABLE (CitaId INT, Estado VARCHAR(20));

        UPDATE dbo.Citas
        SET Estado = 'Cancelada',
            MotivoCancelacion = @Motivo,
            DescripcionCancelacion = @Descripcion,
            SolucionCancelacion = @Solucion,
            FechaCancelacion = SYSDATETIME()
        OUTPUT INSERTED.CitaId, INSERTED.Estado
        INTO @CitaActualizada (CitaId, Estado)
        WHERE CitaId = @CitaId AND NegocioId = @NegocioId AND Estado <> 'Atendida';

        SELECT CitaId, Estado FROM @CitaActualizada;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ ok: false, message: 'No se encontró una cita cancelable.' });
    }

    return res.json({ ok: true, message: 'Cita cancelada correctamente.', cita: result.recordset[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cancelar la cita.', detail: error.message });
  }
});

router.patch('/:id/estado', authenticateToken, async (req, res) => {
  const negocioId = getBusinessId(req);
  const citaId = Number(req.params.id);
  const estadosPermitidos = ['Pendiente', 'Confirmada', 'Atendida', 'No asistió'];
  const estado = String(req.body.estado || '').trim();

  if (!negocioId || !citaId || !estadosPermitidos.includes(estado)) {
    return res.status(400).json({ ok: false, message: 'El estado indicado no es válido.' });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('CitaId', sql.Int, citaId)
      .input('NegocioId', sql.Int, negocioId)
      .input('Estado', sql.VarChar(20), estado)
      .query(`
        DECLARE @CitaActualizada TABLE (CitaId INT, Estado VARCHAR(20));

        UPDATE dbo.Citas
        SET Estado = @Estado
        OUTPUT INSERTED.CitaId, INSERTED.Estado
        INTO @CitaActualizada (CitaId, Estado)
        WHERE CitaId = @CitaId AND NegocioId = @NegocioId AND Estado <> 'Cancelada';

        SELECT CitaId, Estado FROM @CitaActualizada;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ ok: false, message: 'No se encontró una cita actualizable.' });
    }

    return res.json({ ok: true, message: 'Estado de la cita actualizado.', cita: result.recordset[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar la cita.', detail: error.message });
  }
});

module.exports = router;
