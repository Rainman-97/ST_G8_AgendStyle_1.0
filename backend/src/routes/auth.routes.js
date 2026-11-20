const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const { sql, getConnection } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || 'agenda-style-development-secret';

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@gmail\.com$/i.test(email);
}

function isValidName(value) {
  return /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü ]{2,80}$/.test(String(value).trim());
}

function isValidColombianPhone(value) {
  return /^3\d{9}$/.test(String(value).replace(/\D/g, ''));
}

function isValidAddress(value) {
  return /^(calle|cl|carrera|cra|cr|avenida|av|diagonal|diag|transversal|trans)\s+\d+[a-z]?\s*(#|no\.?|n°)\s*\d+[a-z]?\s*-\s*\d+/i.test(String(value).trim());
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
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
      rol: user.Rol,
      negocioId: user.NegocioId || null
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
    return res.status(400).json({ ok: false, message: 'El correo debe terminar en @gmail.com.' });
  }

  if (!isValidName(nombres) || !isValidName(apellidos)) {
    return res.status(400).json({ ok: false, message: 'Nombres y apellidos solo pueden contener letras y espacios.' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ ok: false, message: 'La contraseña debe tener mínimo 8 caracteres.' });
  }

  if (!negocio.nombreComercial || !negocio.tipoNegocio || !negocio.telefono || !negocio.direccion) {
    return res.status(400).json({ ok: false, message: 'Nombre comercial, tipo de negocio, teléfono y dirección son obligatorios.' });
  }

  if (!isValidColombianPhone(negocio.telefono)) {
    return res.status(400).json({ ok: false, message: 'El teléfono debe tener exactamente 10 dígitos y comenzar por 3.' });
  }

  if (!isValidAddress(negocio.direccion) && negocio.ubicadaPorMapa !== true) {
    return res.status(400).json({ ok: false, message: 'Ingresa una dirección colombiana válida, por ejemplo: Calle 10 # 20-30.' });
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
        .input('TipoNegocio', sql.VarChar(30), String(negocio.tipoNegocio).trim())
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

router.post('/forgot-password', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, message: 'Ingresa un correo @gmail.com válido.' });
  }

  try {
    const pool = await getConnection();
    const userResult = await pool.request()
      .input('Email', sql.VarChar(150), email)
      .query('SELECT UsuarioId FROM dbo.Usuarios WHERE Email = @Email AND Activo = 1');

    // No revelamos si el correo está registrado.
    if (userResult.recordset.length === 0) {
      return res.json({ ok: true, message: 'Si el correo está registrado, podrás continuar con la recuperación.' });
    }

    const userId = userResult.recordset[0].UsuarioId;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);

    await pool.request()
      .input('UsuarioId', sql.Int, userId)
      .input('TokenHash', sql.Char(64), tokenHash)
      .query(`
        UPDATE dbo.TokensRecuperacionClave
        SET UsadoEn = SYSDATETIME()
        WHERE UsuarioId = @UsuarioId AND UsadoEn IS NULL;

        INSERT INTO dbo.TokensRecuperacionClave (UsuarioId, TokenHash, ExpiraEn)
        VALUES (@UsuarioId, @TokenHash, DATEADD(MINUTE, 15, SYSDATETIME()));
      `);

    const response = { ok: true, message: 'Se generó un código temporal de recuperación. Tiene una vigencia de 15 minutos.' };
    if (process.env.NODE_ENV !== 'production') response.resetToken = rawToken;
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible iniciar la recuperación.', detail: error.message });
  }
});

router.post('/reset-password', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');
  if (!isValidEmail(email) || !/^[a-f0-9]{64}$/i.test(token) || password.length < 8) {
    return res.status(400).json({ ok: false, message: 'Correo, código temporal y clave válida son obligatorios.' });
  }

  try {
    const pool = await getConnection();
    const tokenHash = hashResetToken(token);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const tokenResult = await new sql.Request(transaction)
        .input('Email', sql.VarChar(150), email)
        .input('TokenHash', sql.Char(64), tokenHash)
        .query(`
          SELECT t.TokenId, t.UsuarioId
          FROM dbo.TokensRecuperacionClave AS t WITH (UPDLOCK, HOLDLOCK)
          INNER JOIN dbo.Usuarios AS u ON u.UsuarioId = t.UsuarioId
          WHERE u.Email = @Email AND u.Activo = 1
            AND t.TokenHash = @TokenHash AND t.UsadoEn IS NULL
            AND t.ExpiraEn > SYSDATETIME();
        `);
      const reset = tokenResult.recordset[0];
      if (!reset) {
        await transaction.rollback();
        return res.status(400).json({ ok: false, message: 'El código es inválido o ya expiró.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await new sql.Request(transaction)
        .input('UsuarioId', sql.Int, reset.UsuarioId)
        .input('PasswordHash', sql.VarChar(255), passwordHash)
        .input('TokenId', sql.Int, reset.TokenId)
        .query(`
          UPDATE dbo.Usuarios SET PasswordHash = @PasswordHash WHERE UsuarioId = @UsuarioId;
          UPDATE dbo.TokensRecuperacionClave SET UsadoEn = SYSDATETIME() WHERE TokenId = @TokenId;
        `);
      await transaction.commit();
      return res.json({ ok: true, message: 'Tu clave fue actualizada correctamente.' });
    } catch (transactionError) {
      try { await transaction.rollback(); } catch (_rollbackError) { /* ya revertida */ }
      throw transactionError;
    }
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar la clave.', detail: error.message });
  }
});

router.get('/perfil', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('UsuarioId', sql.Int, req.user.usuarioId)
      .query(`
        SELECT u.UsuarioId, u.Nombres, u.Apellidos, u.Email, u.Rol, u.FechaRegistro, u.UltimoAcceso,
               n.NegocioId, n.NombreComercial, n.TipoNegocio, n.Telefono AS TelefonoNegocio,
               n.Direccion AS DireccionNegocio, n.Email AS EmailNegocio
        FROM dbo.Usuarios AS u
        LEFT JOIN dbo.Negocios AS n ON n.NegocioId = u.NegocioId
        WHERE u.UsuarioId = @UsuarioId AND u.Activo = 1;
      `);
    const profile = result.recordset[0];
    if (!profile) return res.status(404).json({ ok: false, message: 'No se encontró el perfil.' });
    return res.json({ ok: true, perfil: profile });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'No fue posible cargar el perfil.', detail: error.message });
  }
});

router.patch('/perfil', authenticateToken, async (req, res) => {
  const nombres = String(req.body.nombres || '').trim();
  const apellidos = String(req.body.apellidos || '').trim();
  const email = normalizeEmail(req.body.email);
  const negocio = req.body.negocio || {};
  if (!isValidName(nombres) || !isValidName(apellidos)) {
    return res.status(400).json({ ok: false, message: 'Nombres y apellidos solo pueden contener letras y espacios.' });
  }
  if (!isValidEmail(email)) return res.status(400).json({ ok: false, message: 'El correo debe terminar en @gmail.com.' });

  try {
    const pool = await getConnection();
    const duplicate = await pool.request()
      .input('Email', sql.VarChar(150), email)
      .input('UsuarioId', sql.Int, req.user.usuarioId)
      .query('SELECT UsuarioId FROM dbo.Usuarios WHERE Email = @Email AND UsuarioId <> @UsuarioId');
    if (duplicate.recordset.length) return res.status(409).json({ ok: false, message: 'Ese correo ya está registrado.' });

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input('UsuarioId', sql.Int, req.user.usuarioId)
        .input('Nombres', sql.NVarChar(80), nombres)
        .input('Apellidos', sql.NVarChar(80), apellidos)
        .input('Email', sql.VarChar(150), email)
        .query('UPDATE dbo.Usuarios SET Nombres = @Nombres, Apellidos = @Apellidos, Email = @Email WHERE UsuarioId = @UsuarioId');

      if (req.user.negocioId && (negocio.nombreComercial || negocio.tipoNegocio || negocio.telefono || negocio.direccion)) {
        if (negocio.telefono && !isValidColombianPhone(negocio.telefono)) throw new Error('El teléfono del negocio debe tener 10 dígitos y comenzar por 3.');
        if (negocio.direccion && !isValidAddress(negocio.direccion) && negocio.ubicadaPorMapa !== true) throw new Error('La dirección del negocio no tiene un formato válido.');
        await new sql.Request(transaction)
          .input('NegocioId', sql.Int, req.user.negocioId)
          .input('NombreComercial', sql.NVarChar(120), negocio.nombreComercial ? String(negocio.nombreComercial).trim() : null)
          .input('TipoNegocio', sql.VarChar(30), negocio.tipoNegocio ? String(negocio.tipoNegocio).trim() : null)
          .input('Telefono', sql.VarChar(20), negocio.telefono ? String(negocio.telefono).replace(/\D/g, '') : null)
          .input('Direccion', sql.NVarChar(180), negocio.direccion ? String(negocio.direccion).trim() : null)
          .query(`
            UPDATE dbo.Negocios
            SET NombreComercial = COALESCE(@NombreComercial, NombreComercial),
                TipoNegocio = COALESCE(@TipoNegocio, TipoNegocio),
                Telefono = COALESCE(@Telefono, Telefono),
                Direccion = COALESCE(@Direccion, Direccion)
            WHERE NegocioId = @NegocioId;
          `);
      }
      await transaction.commit();
      return res.json({ ok: true, message: 'Perfil actualizado correctamente.' });
    } catch (transactionError) {
      try { await transaction.rollback(); } catch (_rollbackError) { /* ya revertida */ }
      throw transactionError;
    }
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message || 'No fue posible actualizar el perfil.' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  return res.json({ ok: true, user: req.user });
});

module.exports = router;
