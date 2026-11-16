const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const { sql } = require('../config/database');

async function predictAbsenceRisk(features) {
  const response = await fetch(`${aiServiceUrl}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(features)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.detail || 'El servicio de IA no pudo generar la predicción.');
  }
  return data;
}

async function calculateAndSaveAbsenceRisk(pool, citaId, negocioId) {
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
  if (!cita) throw new Error('No se encontró la cita para evaluar.');

  const start = new Date(cita.FechaHoraInicio);
  const created = new Date(cita.FechaCreacion);
  const advanceDays = Math.max(0, Math.min(30, Math.floor((start - created) / 86400000)));
  const hour = start.getUTCHours();
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
    `);
  return { prediction, features, saved: saved.rowsAffected };
}

module.exports = { predictAbsenceRisk, calculateAndSaveAbsenceRisk };
