const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, message: 'Se requiere un token Bearer.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'agenda-style-development-secret');
    next();
  } catch (_error) {
    return res.status(401).json({ ok: false, message: 'El token no es válido o ya expiró.' });
  }
}

module.exports = { authenticateToken };
