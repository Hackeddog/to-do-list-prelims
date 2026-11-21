const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./src/routes/auth.routes');
const { testConnection, ensureDefaultRoles } = require('./db');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in the shared root .env file');
}

const app = express();
const port = Number(process.env.AUTH_PORT || 4000);

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5000,http://localhost')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many authentication requests, please try again later' }
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cookieParser());
app.use(express.json());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.get('/health', async (req, res) => {
  try {
    await testConnection();
    return res.json({ status: 'ok', service: 'auth-server', database: 'connected' });
  } catch (error) {
    return res.status(503).json({ status: 'error', service: 'auth-server', database: error.message });
  }
});

app.use(authLimiter);
app.use(authRoutes);
app.use((req, res) => res.status(404).json({ error: 'endpoint not found' }));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(port, async () => {
  console.log(`Auth Server running at http://localhost:${port}`);
  try {
    await testConnection();
    await ensureDefaultRoles();
    console.log('Auth Server connected to MariaDB and verified default roles.');
  } catch (error) {
    console.warn(`Auth Server MariaDB check failed (${error.code || error.message}). Make sure MariaDB is running and database/schema.sql has been imported.`);
  }
});
