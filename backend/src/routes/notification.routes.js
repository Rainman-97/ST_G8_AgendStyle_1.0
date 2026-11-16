const express = require('express');

const { sql, getConnection } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');
const { sendNotification } = require('../services/notification.service');
const { calculateAndSaveAbsenceRisk } = require('../services/ai.service');

const router = express.Router();

function getBusinessId(req) {
  const negocioId = Number(req.user?.negocioId);
  return Number.isInteger(negocioId) && negocioId > 0 ? negocioId : null;
}

router.post('/citas/:id/enviar', authenticateToken, async (req, res) => {
  const negocioId = getBusinessId(req);
  const citaId = Number(req.params.id);
  const canal = req.body.canal === 'SMS' ? 'SMS' : req.body.canal === 'WhatsApp' ? 'WhatsApp' : null;
  if (!negocioId || !citaId || !canal) return res.status(400).json({ ok: false, message: 'Cita y canal de notificación son obligatorios.' });

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('CitaId', sql.Int, citaId)
      .input('NegocioId', sql.Int, negocioId)
      .query(`
        SELECT c.CitaId, c.FechaHoraInicio, c.Estado,
          CONCAT(cl.Nombres, ' ', cl.Apellidos) AS Cliente,
          cl.Telefono, s.Nombre AS Servicio,
          p.NivelRiesgo, p.Probabilidad, p.AccionRecordatorio
        FROM dbo.Citas AS c
        INNER JOIN dbo.Clientes AS cl ON cl.ClienteId = c.ClienteId
        INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
        LEFT JOIN dbo.PrediccionesInasistencia AS p ON p.CitaId = c.CitaId
        WHERE c.CitaId = @CitaId AND c.NegocioId = @NegocioId AND c.Estado NOT IN ('Cancelada', 'Atendida');
      `);
    const cita = result.recordset[0];
    if (!cita) return res.status(404).json({ ok: false, message: 'La cita no existe o no permite notificaciones.' });

    let risk = cita;
    if (!risk.NivelRiesgo) {
      try {
        await calculateAndSaveAbsenceRisk(pool, citaId, negocioId);
        const refreshed = await pool.request().input('CitaId', sql.Int, citaId).query('SELECT TOP 1 NivelRiesgo, Probabilidad, AccionRecordatorio FROM dbo.PrediccionesInasistencia WHERE CitaId = @CitaId');
        risk = { ...risk, ...(refreshed.recordset[0] || {}) };
      } catch (aiError) {
        console.warn('Notificación con estrategia estándar:', aiError.message);
      }
    }

    const start = new Date(cita.FechaHoraInicio);
    const date = start.toLocaleDateString('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' });
    const time = start.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
    const message = `Hola ${cita.Cliente}, te recordamos tu cita de ${cita.Servicio} el ${date} a las ${time}. Responde a este mensaje si necesitas confirmar o solicitar un cambio. AgendaStyle.`;
    const delivery = await sendNotification(canal, cita.Telefono, message);
    const estado = delivery.provider === 'Mock' ? 'Simulado' : 'Enviado';

    await pool.request()
      .input('CitaId', sql.Int, citaId)
      .input('Canal', sql.VarChar(15), canal)
      .input('Destino', sql.VarChar(30), delivery.destino || cita.Telefono)
      .input('Mensaje', sql.NVarChar(1000), message)
      .input('Estado', sql.VarChar(20), estado)
      .input('Proveedor', sql.VarChar(30), delivery.provider)
      .input('ProveedorMessageId', sql.VarChar(80), delivery.providerMessageId)
      .query(`
        INSERT INTO dbo.NotificacionesCitas (CitaId, Canal, Destino, Mensaje, Estado, Proveedor, ProveedorMessageId, EnviadoEn)
        VALUES (@CitaId, @Canal, @Destino, @Mensaje, @Estado, @Proveedor, @ProveedorMessageId, SYSDATETIME());
      `);

    return res.json({ ok: true, estado, canal, proveedor: delivery.provider, nivelRiesgo: risk.NivelRiesgo || 'No calculado', message: delivery.provider === 'Mock' ? 'Notificación simulada; configura Twilio para enviarla realmente.' : 'Notificación enviada correctamente.' });
  } catch (error) {
    return res.status(502).json({ ok: false, message: 'No fue posible enviar la notificación.', detail: error.message });
  }
});

module.exports = router;
