const { isAuthed, passwordOk, setPassword, readBody } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }
  if (!isAuthed(req)) return res.status(401).json({ ok: false, error: 'Not signed in.' });
  const { current, next } = await readBody(req);
  if (!(await passwordOk(current))) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return res.status(403).json({ ok: false, error: 'Current password is wrong.' });
  }
  const pw = String(next || '');
  if (pw.length < 10 || pw.length > 200) return res.status(400).json({ ok: false, error: 'New password must be at least 10 characters.' });
  if (pw === String(current)) return res.status(400).json({ ok: false, error: 'Pick a different password than the current one.' });
  try { await setPassword(pw); } catch (e) {
    console.error('password change failed:', e.message);
    return res.status(500).json({ ok: false, error: 'Could not save the new password.' });
  }
  return res.status(200).json({ ok: true });
};
