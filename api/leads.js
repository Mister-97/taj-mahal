const { db } = require('../lib/db');
const { isAuthed, readBody } = require('../lib/auth');

const STATUSES = ['new', 'contacted', 'booked', 'closed'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAuthed(req)) return res.status(401).json({ ok: false, error: 'Not signed in.' });
  try {
    const sql = await db();
    if (req.method === 'GET') {
      const leads = await sql`SELECT * FROM leads ORDER BY created_at DESC LIMIT 1000`;
      return res.status(200).json({ ok: true, leads });
    }
    if (req.method === 'PATCH') {
      const { id, status, notes } = await readBody(req);
      if (!Number.isInteger(id)) return res.status(400).json({ ok: false });
      if (status !== undefined) {
        if (!STATUSES.includes(status)) return res.status(400).json({ ok: false });
        await sql`UPDATE leads SET status = ${status} WHERE id = ${id}`;
      }
      if (notes !== undefined) await sql`UPDATE leads SET notes = ${String(notes).slice(0, 4000)} WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const { id } = await readBody(req);
      if (!Number.isInteger(id)) return res.status(400).json({ ok: false });
      await sql`DELETE FROM leads WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ ok: false });
  } catch (e) {
    console.error('leads api failed:', e.message);
    return res.status(500).json({ ok: false, error: 'Database error.' });
  }
};
