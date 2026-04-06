require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const path = require('path');

const { connectDb } = require('./config/db');
const { API_PREFIX, MAX_BODY_SIZE, REQUEST_TIMEOUT_MS } = require('./config/constants');
const { logger } = require('./utils/logger');

const { errorMiddleware } = require('./middleware/error.middleware');
const { buildCspDirectives } = require('./middleware/security.middleware');

const app = express();

const isVercel = !!process.env.VERCEL;

app.set('trust proxy', 1);

// ── Segurança & Performance ──────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: buildCspDirectives()
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  })
);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);
      return cb(null, allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    maxAge: 3600,
    optionsSuccessStatus: 200
  })
);

app.use(compression());
app.use(cookieParser());
app.use(mongoSanitize());
app.use(express.json({ limit: MAX_BODY_SIZE }));
app.use(express.urlencoded({ extended: true, limit: MAX_BODY_SIZE }));

app.use((req, _res, next) => {
  req.setTimeout(REQUEST_TIMEOUT_MS);
  next();
});

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

/** Não depende do Mongo — útil para validar deploy na Vercel sem derrubar a função */
app.get(`${API_PREFIX}/health`, (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    mongo: {
      readyState: mongoose.connection.readyState,
      hasUri: Boolean(process.env.MONGODB_URI)
    }
  });
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Muitas requisições. Tente novamente em breve.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.method === 'GET' && req.path === `${API_PREFIX}/posts`
});
app.use(API_PREFIX, globalLimiter);

// ── Static uploads (apenas em ambiente local, na Vercel usa rota do vercel.json) ──
if (!isVercel) {
  app.use('/uploads', express.static('public/assets/images/uploads', { maxAge: '7d', immutable: true }));
}

// ── SSE (público: não enviar dados sensíveis) ────────────────────────────
const clients = new Set();
app.get(`${API_PREFIX}/events`, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  clients.add(res);
  req.on('close', () => clients.delete(res));
});

global.broadcast = (event, data) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try {
      client.write(payload);
    } catch (_err) {
      clients.delete(client);
    }
  });
};

// ── Vercel: conecta ao Mongo antes das rotas /api (exceto health e raiz) ──
if (isVercel) {
  app.use(async (req, res, next) => {
    if (req.path === '/' || req.path === `${API_PREFIX}/health`) return next();
    try {
      await ensureDb();
    } catch (err) {
      logger.error({ msg: 'MongoDB indisponível (serverless)', error: err.message, stack: err.stack });
      return res.status(503).json({
        success: false,
        message:
          'Banco de dados indisponível. Confira MONGODB_URI nas variáveis da Vercel e Network Access no MongoDB Atlas (0.0.0.0/0 ou IPs permitidos).'
      });
    }
    next();
  });
}

app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'API FJS Topografia',
    health: `${API_PREFIX}/health`
  });
});

// ── Rotas ────────────────────────────────────────────────────────────────
app.use(`${API_PREFIX}/auth`, require('./routes/auth'));
app.use(`${API_PREFIX}/posts`, require('./routes/posts'));
app.use(`${API_PREFIX}/pages`, require('./routes/pages'));
app.use(`${API_PREFIX}/upload`, require('./routes/upload'));
app.use(`${API_PREFIX}/service-images`, require('./routes/serviceImages'));
app.use(`${API_PREFIX}/images`, require('./routes/images'));

// ── Frontend estático (apenas em ambiente local) ─────────────────────────
if (!isVercel) {
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir, { maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith(API_PREFIX)) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// ── Error handler ────────────────────────────────────────────────────────
app.use(errorMiddleware);

// ── Boot ────────────────────────────────────────────────────────────────
let dbConnected = false;

async function ensureDb() {
  if (dbConnected) return;
  if (process.env.SKIP_DB === 'true' || !process.env.MONGODB_URI) {
    dbConnected = true;
    return;
  }
  await connectDb();
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB não conectado');
  }
  dbConnected = true;
}

if (!isVercel) {
  (async () => {
    try {
      await ensureDb();
      const port = Number(process.env.PORT || 3000);
      app.listen(port, () => logger.info({ msg: 'Servidor iniciado', port }));
    } catch (err) {
      logger.error({ msg: 'Falha ao iniciar', error: err.message, stack: err.stack });
      process.exit(1);
    }
  })();
}

// ── Vercel / Node: exporta o Express (runtime Node da Vercel invoca como handler)
module.exports = app;
