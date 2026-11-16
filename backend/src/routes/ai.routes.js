const express = require('express');

const { sql, getConnection } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');
const { predictAbsenceRisk } = require('../services/ai.service');

const router = express.Router();

function getBusinessId(req) {
  const businessId = Number(req.user?.negocioId);
  return Number.isInteger(businessId) && businessId > 0 ? businessId : null;
}

router.get('/health', async (_req, res) => {
  try {
    const response = await fetch(`${process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'}/health`);
    return res.status(response.ok ? 200 : 502).json(await response.json());
  } catch (error) {
    return res.status(503).json({ ok: false, message: 'El servicio de IA no está disponible.', detail: error.message });
  }
});

router.post('/citas/:id/riesgo', authenticateToken, async (req, res) => {
  const negocioId = getBusinessId(req);
  const citaId = Number(req.params.id);
  if (!negocioId || !citaId) return res.status(400).json({ ok: false, message: 'La cita indicada no es válida.' });

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('CitaId', sql.Int, citaId)
      .input('NegocioId', sql.Int, negocioId)
      .query(`
        SELECT c.CitaId, c.FechaCreacion, c.FechaHoraInicio,
          (SELECT COUNT(*) FROM dbo.Citas AS prev WHERE prev.ClienteId = c.ClienteId AND prev.NegocioId = c.NegocioId AND prev.Estado = 'No asistió' AND prev.CitaId <> c.CitaId) AS InasistenciasPrevias,
          (SELECT COUNT(*) FROM dbo.Citas AS prev WHERE prev.ClienteId = c.ClienteId AND prev.NegocioId = c.NegocioId AND prev.Estado = 'Atendida' AND prev.CitaId <> c.CitaId) AS CitasAtendidas
        FROM dbo.Citas AS c
        WHERE c.CitaId = @CitaId AND c.NegocioId = @NegocioId;
      `);
    const cita = result.recordset[0];
    if (!cita) return res.status(404).json({ ok: false, message: 'No se encontró la cita.' });

    const advanceDays = Math.max(0, Math.min(30, Math.floor((new Date(cita.FechaHoraInicio) - new Date(cita.FechaCreacion)) / 86400000)));
    const hour = new Date(cita.FechaHoraInicio).getUTCHours();
    const features = {
      inasistencias_previas: Math.min(Number(cita.InasistenciasPrevias || 0), 5) / 5,
      antelacion_reserva: advanceDays / 30,
      franja_horaria: Math.max(0, Math.min(1, (hour - 8) / 12)),
      cliente_nuevo: Number(cita.CitasAtendidas || 0) === 0 ? 1 : 0
    };
    const prediction = await predictAbsenceRisk(features);
    const saved = await pool.request()
      .input('CitaId', sql.Int, citaId)
      .input('InasistenciasPrevias', sql.Decimal(6, 4), features.inasistencias_previas)
      .input('AntelacionReserva', sql.Decimal(6, 4), features.antelacion_reserva)
      .input('FranjaHoraria', sql.Decimal(6, 4), features.franja_horaria)
      .input('ClienteNuevo', sql.Decimal(6, 4), features.cliente_nuevo)
      .input('Probabilidad', sql.Decimal(6, 4), prediction.probabilidad)
      .input('NivelRiesgo', sql.VarChar(10), prediction.nivel)
      .input('AccionRecordatorio', sql.NVarChar(160), prediction.accion)
      .input('ModeloVersion', sql.VarChar(30), prediction.modelo)
      .query(`
        MERGE dbo.PrediccionesInasistencia AS destino
        USING (SELECT @CitaId AS CitaId) AS origen ON destino.CitaId = origen.CitaId
        WHEN MATCHED THEN UPDATE SET InasistenciasPrevias = @InasistenciasPrevias, AntelacionReserva = @AntelacionReserva, FranjaHoraria = @FranjaHoraria, ClienteNuevo = @ClienteNuevo, Probabilidad = @Probabilidad, NivelRiesgo = @NivelRiesgo, AccionRecordatorio = @AccionRecordatorio, ModeloVersion = @ModeloVersion, FechaPrediccion = SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT (CitaId, InasistenciasPrevias, AntelacionReserva, FranjaHoraria, ClienteNuevo, Probabilidad, NivelRiesgo, AccionRecordatorio, ModeloVersion) VALUES (@CitaId, @InasistenciasPrevias, @AntelacionReserva, @FranjaHoraria, @ClienteNuevo, @Probabilidad, @NivelRiesgo, @AccionRecordatorio, @ModeloVersion);
        SELECT * FROM dbo.PrediccionesInasistencia WHERE CitaId = @CitaId;
      `);
    return res.json({ ok: true, prediccion: saved.recordset[0], caracteristicas: features });
  } catch (error) {
    return res.status(502).json({ ok: false, message: 'No fue posible calcular el riesgo de inasistencia.', detail: error.message });
  }
});

module.exports = router;
