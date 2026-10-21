const crypto = require('crypto');

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

function passwordOk(input) {
  const pw = process.env.TEAM_PASSWORD || '';
  return pw.length > 0 && safeEqual(input || '', pw);
}

// Email is optional in env: if TEAM_EMAIL is set the login must match it (case-insensitive).
function credentialsOk(email, password) {
  const want = (process.env.TEAM_EMAIL || '').trim().toLowerCase();
  const emailMatches = !want || safeEqual(String(email || '').trim().toLowerCase(), want);
  return passwordOk(password) && emailMatches;
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

module.exports = { credentialsOk, passwordOk, sessionCookie, clearCookie, isAuthed, readBody };
