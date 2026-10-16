const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { sql, getConnection } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || 'agenda-style-development-secret';

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(user) {
  return {
    usuarioId: user.UsuarioId,
    nombres: user.Nombres,
    apellidos: user.Apellidos,
    email: user.Email,
    rol: user.Rol,
    negocioId: user.NegocioId || null,
    negocio: user.NombreComercial ? {
      nombreComercial: user.NombreComercial,
      tipoNegocio: user.TipoNegocio
    } : null
  };
}

function createToken(user) {
  return jwt.sign(
    {
      usuarioId: user.UsuarioId,
      email: user.Email,
      rol: user.Rol
    },
    jwtSecret,
    { expiresIn: '8h' }
  );
}

router.post('/register', async (req, res) => {
  const { nombres, apellidos, password, negocio } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!nombres || !apellidos || !email || !password || !negocio) {
    return res.status(400).json({ ok: false, message: 'Completa tus datos personales y los datos del negocio.' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, message: 'El formato del email no es válido.' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ ok: false, message: 'La contraseña debe tener mínimo 8 caracteres.' });
  }

  if (!negocio.nombreComercial || !negocio.tipoNegocio || !negocio.telefono) {
    return res.status(400).json({ ok: false, message: 'Nombre comercial, tipo de negocio y teléfono son obligatorios.' });
  }

  try {
    const pool = await getConnection();
    const existing = await pool.request()
      .input('Email', sql.VarChar(150), email)
      .query('SELECT UsuarioId FROM dbo.Usuarios WHERE Email = @Email');

    if (existing.recordset.length > 0) {
      return res.status(409).json({ ok: false, message: 'Ya existe un usuario registrado con ese email.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 12);
    const transaction = new sql.Transaction(pool);

    await transaction.begin();
    try {
      const businessResult = await new sql.Request(transaction)
        .input('NombreComercial', sql.NVarChar(120), String(negocio.nombreComercial).trim())
        .input('TipoNegocio', sql.VarChar(20), String(negocio.tipoNegocio).trim())
        .input('TelefonoNegocio', sql.VarChar(20), String(negocio.telefono).trim())
        .input('Direccion', sql.NVarChar(180), negocio.direccion ? String(negocio.direccion).trim() : null)
        .input('EmailNegocio', sql.VarChar(150), negocio.email ? normalizeEmail(negocio.email) : null)
        .query(`
          INSERT INTO dbo.Negocios (NombreComercial, TipoNegocio, Telefono, Direccion, Email)
          OUTPUT INSERTED.NegocioId, INSERTED.NombreComercial, INSERTED.TipoNegocio
          VALUES (@NombreComercial, @TipoNegocio, @TelefonoNegocio, @Direccion, @EmailNegocio)
        `);

      const business = businessResult.recordset[0];
      const userResult = await new sql.Request(transaction)
        .input('Nombres', sql.NVarChar(80), String(nombres).trim())
        .input('Apellidos', sql.NVarChar(80), String(apellidos).trim())
        .input('Email', sql.VarChar(150), email)
        .input('PasswordHash', sql.VarChar(255), passwordHash)
        .input('NegocioId', sql.Int, business.NegocioId)
        .query(`
          INSERT INTO dbo.Usuarios (Nombres, Apellidos, Email, PasswordHash, Rol, NegocioId)
          OUTPUT INSERTED.UsuarioId, INSERTED.Nombres, INSERTED.Apellidos, INSERTED.Email, INSERTED.Rol, INSERTED.NegocioId
          VALUES (@Nombres, @Apellidos, @Email, @PasswordHash, 'Administrador', @NegocioId)
        `);

      await transaction.commit();
      const user = userResult.recordset[0];
      return res.status(201).json({ ok: true, message: 'Negocio y cuenta de administrador creados correctamente.', user: publicUser(user), negocio: business });
    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible registrar el usuario.', detail: error.message });
  }
});

router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'Email y contraseña son obligatorios.' });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('Email', sql.VarChar(150), email)
      .query(`
        SELECT u.UsuarioId, u.Nombres, u.Apellidos, u.Email, u.PasswordHash, u.Rol, u.Activo,
               u.NegocioId, n.NombreComercial, n.TipoNegocio
        FROM dbo.Usuarios AS u
        LEFT JOIN dbo.Negocios AS n ON n.NegocioId = u.NegocioId
        WHERE u.Email = @Email
      `);

    const user = result.recordset[0];
    const passwordMatches = user && await bcrypt.compare(String(password), user.PasswordHash);

    if (!user || !passwordMatches) {
      return res.status(401).json({ ok: false, message: 'Email o contraseña incorrectos.' });
    }

    if (!user.Activo) {
      return res.status(403).json({ ok: false, message: 'El usuario se encuentra inactivo.' });
    }

    await pool.request()
      .input('UsuarioId', sql.Int, user.UsuarioId)
      .query('UPDATE dbo.Usuarios SET UltimoAcceso = SYSDATETIME() WHERE UsuarioId = @UsuarioId');

    return res.json({ ok: true, message: 'Inicio de sesión exitoso.', token: createToken(user), user: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible iniciar sesión.', detail: error.message });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  return res.json({ ok: true, user: req.user });
});

module.exports = router;
