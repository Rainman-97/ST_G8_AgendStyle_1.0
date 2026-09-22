const express = require('express');
const cors = require('cors');
require('dotenv').config();

const healthRoutes = require('./routes/health.routes');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

app.get('/api', (_req, res) => {
  res.json({
    name: 'AgendaStyle API',
    version: '1.0.0',
    status: 'initial-structure'
  });
});

app.use('/api/health', healthRoutes);

app.use((_req, res) => {
  res.status(404).json({ ok: false, message: 'Ruta no encontrada.' });
});

app.listen(port, () => {
  console.log(`AgendaStyle API ejecutándose en http://localhost:${port}`);
});
