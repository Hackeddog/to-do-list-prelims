const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const postRoutes = require('./src/routes/post.routes');
const { testConnection } = require('./db');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in the shared root .env file');
}

const app = express();
const port = Number(process.env.BLOG_PORT || 5000);
const authPort = Number(process.env.AUTH_PORT || 4000);
const frontendDistDir = path.resolve(__dirname, '../frontend/dist');
const frontendIndexFile = path.join(frontendDistDir, 'index.html');

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5000,http://localhost')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const connectSrcOrigins = [
  "'self'",
  `http://localhost:${authPort}`,
  `http://127.0.0.1:${authPort}`,
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`
];

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many API requests, please try again later' }
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: connectSrcOrigins,
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: null
      }
    }
  })
);
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
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.get('/health', async (req, res) => {
  try {
    await testConnection();
    return res.json({ status: 'ok', service: 'blog-server', database: 'connected' });
  } catch (error) {
    return res.status(503).json({ status: 'error', service: 'blog-server', database: error.message });
  }
});

app.use('/api', apiLimiter, postRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'endpoint not found' }));

if (fs.existsSync(frontendIndexFile)) {
  app.use(express.static(frontendDistDir));
  app.get('/{*splat}', (req, res) => res.sendFile(frontendIndexFile));
} else {
  app.get('/', (req, res) => {
    res.json({
      message: 'Blog API is running. Start the React frontend with "npm run frontend" or build it with "npm run frontend:build".',
      endpoints: [
        'GET /api/posts',
        'GET /api/posts/:id',
        'POST /api/posts',
        'PUT /api/posts/:id',
        'DELETE /api/posts/:id',
        'GET /api/me/posts'
      ]
    });
  });
}

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(port, async () => {
  console.log(`Blog Server running at http://localhost:${port}`);
  try {
    await testConnection();
    console.log('Blog Server connected to MariaDB.');
  } catch (error) {
    console.warn(`Blog Server MariaDB check failed (${error.code || error.message}). Make sure MariaDB is running and database/schema.sql has been imported.`);
  }
});
