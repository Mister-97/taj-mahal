const crypto = require('crypto');
const { db } = require('./db');

const COOKIE = 'tm_team';
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function secret() {
  return process.env.SESSION_SECRET || process.env.TEAM_PASSWORD || '';
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('hex');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// A password changed from the portal is stored as a scrypt hash in team_settings and wins over the
// TEAM_PASSWORD env var, which stays as the first-time password and the fallback if the DB is down.
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}

function hashOk(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  return safeEqual(crypto.scryptSync(pw, salt, 64).toString('hex'), hash);
}

async function storedHash() {
  try {
    const sql = await db();
    const rows = await sql`SELECT value FROM team_settings WHERE key = 'password_hash'`;
    return rows[0] ? rows[0].value : null;
  } catch (e) { console.error('password lookup failed:', e.message); return null; }
}

async function passwordOk(input) {
  const pw = String(input || '');
  const hash = await storedHash();
  if (hash) return hashOk(pw, hash);
  const env = process.env.TEAM_PASSWORD || '';
  return env.length > 0 && safeEqual(pw, env);
}

async function setPassword(pw) {
  const sql = await db();
  await sql`INSERT INTO team_settings (key, value) VALUES ('password_hash', ${hashPassword(pw)})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

// Email is optional in env: if TEAM_EMAIL is set the login must match it (case-insensitive).
async function credentialsOk(email, password) {
  const want = (process.env.TEAM_EMAIL || '').trim().toLowerCase();
  const emailMatches = !want || safeEqual(String(email || '').trim().toLowerCase(), want);
  return (await passwordOk(password)) && emailMatches;
}

function sessionCookie() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}

function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function isAuthed(req) {
  if (!secret()) return false;
  const m = /(?:^|;\s*)tm_team=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, sign(exp));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

module.exports = { credentialsOk, passwordOk, setPassword, sessionCookie, clearCookie, isAuthed, readBody };
