const { credentialsOk, sessionCookie, clearCookie, readBody } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'DELETE') { res.setHeader('Set-Cookie', clearCookie()); return res.status(200).json({ ok: true }); }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, DELETE'); return res.status(405).json({ ok: false }); }
  const { email, password } = await readBody(req);
  if (!credentialsOk(email, password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return res.status(401).json({ ok: false, error: 'Wrong email or password.' });
  }
  res.setHeader('Set-Cookie', sessionCookie());
  return res.status(200).json({ ok: true });
};
