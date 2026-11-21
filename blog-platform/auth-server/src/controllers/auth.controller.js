const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool, ensureDefaultRoles } = require('../../db');
const { hashPassword, verifyPassword, hashToken } = require('../utils/password');

const ALLOWED_ROLES = ['reader', 'author', 'admin'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id,
      type: 'refresh',
      jti: crypto.randomUUID()
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

async function register(req, res) {
  const { email, username, password, role } = req.body || {};
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  const normalizedPassword = typeof password === 'string' ? password : '';
  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';

  if (!normalizedUsername || !normalizedPassword || !normalizedRole) {
    return res.status(400).json({ error: 'username, password, and role are required' });
  }
  if (normalizedUsername.length > 50) {
    return res.status(400).json({ error: 'username must be 50 characters or fewer' });
  }
  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    return res.status(400).json({ error: 'role must be reader, author, or admin' });
  }

  let normalizedEmail;
  if (email !== undefined) {
    normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail) || normalizedEmail.length > 255) {
      return res.status(400).json({ error: 'a valid email address is required' });
    }
  } else {
    normalizedEmail = `${normalizedUsername.toLowerCase()}@blog.local`;
  }

  const [existingUsers] = await pool.query(
    `SELECT id, username, email
     FROM users
     WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
     LIMIT 1`,
    [normalizedUsername, normalizedEmail]
  );

  if (existingUsers.length > 0) {
    const existing = existingUsers[0];
    const emailConflict = existing.email.toLowerCase() === normalizedEmail.toLowerCase();
    return res.status(409).json({
      error: emailConflict ? 'email is already registered' : 'username is already taken'
    });
  }

  let [roleRows] = await pool.query('SELECT id, role FROM roles WHERE role = ? LIMIT 1', [normalizedRole]);
  if (roleRows.length === 0) {
    await ensureDefaultRoles();
    [roleRows] = await pool.query('SELECT id, role FROM roles WHERE role = ? LIMIT 1', [normalizedRole]);
  }
  if (roleRows.length === 0) {
    return res.status(500).json({ error: 'role configuration is missing in database' });
  }

  const passwordHash = hashPassword(normalizedPassword);
  const [result] = await pool.query(
    `INSERT INTO users (email, username, password_hash, role_id, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [normalizedEmail, normalizedUsername, passwordHash, roleRows[0].id]
  );

  const [createdRows] = await pool.query(
    `SELECT u.id, u.email, u.username, r.role, u.is_active, u.created_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [result.insertId]
  );

  return res.status(201).json(createdRows[0]);
}

async function login(req, res) {
  const { username, email, password } = req.body || {};
  const identifier = typeof username === 'string' && username.trim()
    ? username.trim()
    : (typeof email === 'string' ? email.trim() : '');
  const normalizedPassword = typeof password === 'string' ? password : '';

  if (!identifier || !normalizedPassword) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.username, u.password_hash, u.is_active, r.role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?)
     LIMIT 1`,
    [identifier, identifier]
  );

  const user = rows[0];
  if (!user || !user.is_active || !verifyPassword(normalizedPassword, user.password_hash)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);
  const tokenHash = hashToken(refreshToken);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [user.id, tokenHash]
  );

  res.cookie('refreshToken', refreshToken, refreshCookieOptions());

  return res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  });
}

async function refresh(req, res) {
  const token = req.body?.refreshToken || req.cookies?.refreshToken;
  if (!token) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'invalid or expired refresh token' });
  }

  if (payload.type !== 'refresh') {
    return res.status(401).json({ error: 'access tokens cannot be refreshed here' });
  }

  const tokenHash = hashToken(token);
  const [rows] = await pool.query(
    `SELECT rt.id AS token_id, u.id, u.email, u.username, u.is_active, r.role
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE rt.token_hash = ?
       AND rt.revoked_at IS NULL
       AND rt.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );

  const session = rows[0];
  if (!session || !session.is_active) {
    return res.status(401).json({ error: 'refresh token is invalid, expired, or revoked' });
  }

  return res.json({ accessToken: createAccessToken(session) });
}

async function logout(req, res) {
  const token = req.body?.refreshToken || req.cookies?.refreshToken;
  if (!token) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  const tokenHash = hashToken(token);
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = ? AND revoked_at IS NULL`,
    [tokenHash]
  );

  res.clearCookie('refreshToken', { path: '/' });
  return res.json({ message: 'logged out successfully' });
}

module.exports = { register, login, refresh, logout };
