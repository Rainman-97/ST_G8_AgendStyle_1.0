const notificationMode = String(process.env.NOTIFICATIONS_MODE || 'mock').toLowerCase();

function normalizeColombianPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!/^3\d{9}$/.test(digits)) throw new Error('El teléfono del cliente no es un celular colombiano válido.');
  return `+57${digits}`;
}

async function sendTwilio(channel, phone, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) throw new Error('Faltan TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN.');

  const from = channel === 'WhatsApp'
    ? process.env.TWILIO_WHATSAPP_FROM
    : process.env.TWILIO_SMS_FROM;
  if (!from) throw new Error(`Falta configurar el remitente de ${channel}.`);

  const to = channel === 'WhatsApp' ? `whatsapp:${phone}` : phone;
  const body = new URLSearchParams({ To: to, From: from, Body: message });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Twilio rechazó el envío.');
  return { provider: 'Twilio', providerMessageId: data.sid, status: data.status };
}

async function sendNotification(channel, phone, message) {
  const normalizedPhone = normalizeColombianPhone(phone);
  if (notificationMode !== 'twilio') {
    return { provider: 'Mock', providerMessageId: null, status: 'simulated', destino: normalizedPhone };
  }
  return sendTwilio(channel, normalizedPhone, message);
}

module.exports = { sendNotification, normalizeColombianPhone };
