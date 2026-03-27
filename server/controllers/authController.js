const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { ok, fail } = require('../utils/response');

function cookieOptions() {
  const secure =
    process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false');
  const sameSite = (process.env.COOKIE_SAMESITE || 'strict').toLowerCase();
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

async function generateTokens(adminId) {
  const accessToken = jwt.sign({ id: adminId, type: 'access' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    algorithm: 'HS256'
  });

  const refreshTokenValue = crypto.randomBytes(32).toString('hex');
  const refreshToken = jwt.sign({ id: adminId, type: 'refresh', token: refreshTokenValue }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: 'HS256'
  });

  const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');
  return { accessToken, refreshToken, refreshTokenHash };
}

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email: loginIdRaw, password } = req.body;
  const loginId = String(loginIdRaw || '').trim().toLowerCase();

  const admin = await Admin.findOne({
    isActive: true,
    $or: [{ email: loginId }, { username: loginId }]
  }).select('+password +refreshTokenHash +refreshTokenExpiry');
  if (!admin || !(await admin.comparePassword(password))) return fail(res, 401, 'Credenciais inválidas');

  const { accessToken, refreshToken, refreshTokenHash } = await generateTokens(admin._id);
  admin.lastLogin = new Date();
  admin.refreshTokenHash = refreshTokenHash;
  admin.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await admin.save({ validateBeforeSave: false });

  res.cookie('refreshToken', refreshToken, cookieOptions());

  return ok(res, {
    accessToken,
    admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role }
  });
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  await Admin.findByIdAndUpdate(req.admin._id, { refreshTokenHash: null, refreshTokenExpiry: null });
  res.clearCookie('refreshToken', { path: '/' });
  return ok(res, { loggedOut: true });
};

// POST /api/auth/refresh
exports.refresh = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return fail(res, 401, 'Token não fornecido');

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
    if (decoded?.type !== 'refresh' || !decoded?.token) return fail(res, 401, 'Token inválido');

    const tokenHash = crypto.createHash('sha256').update(decoded.token).digest('hex');
    const admin = await Admin.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiry');

    if (!admin || !admin.refreshTokenHash || admin.refreshTokenHash !== tokenHash) return fail(res, 401, 'Token inválido');
    if (admin.refreshTokenExpiry && new Date() > admin.refreshTokenExpiry) return fail(res, 401, 'Token expirado');

    const { accessToken, refreshToken, refreshTokenHash } = await generateTokens(admin._id);
    admin.refreshTokenHash = refreshTokenHash;
    admin.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await admin.save({ validateBeforeSave: false });

    res.cookie('refreshToken', refreshToken, cookieOptions());
    return ok(res, { accessToken });
  } catch (_err) {
    return fail(res, 401, 'Token inválido ou expirado');
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  const admin = await Admin.findById(req.admin._id);
  if (!admin) return fail(res, 404, 'Admin não encontrado');
  return ok(res, { id: admin._id, name: admin.name, email: admin.email, role: admin.role });
};

