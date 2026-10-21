const { db } = require('../lib/db');
const { readBody } = require('../lib/auth');

const FIELDS = ['full_name', 'email', 'phone', 'company', 'event_type', 'event_date', 'budget', 'location', 'message'];
const MAX = { message: 4000 };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function clean(body) {
  const out = {};
  for (const k of FIELDS) out[k] = String(body[k] == null ? '' : body[k]).trim().slice(0, MAX[k] || 300);
  return out;
}

async function sendEmail(lead) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_FROM;
  const to = (process.env.LEAD_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!key || !from || !to.length) throw new Error('Resend is not configured (RESEND_API_KEY, LEAD_FROM, LEAD_TO)');

  const rows = [
    ['Name', lead.full_name], ['Email', lead.email], ['Phone', lead.phone], ['Organization', lead.company],
    ['Event type', lead.event_type], ['Event date', lead.event_date], ['Budget', lead.budget],
    ['Location', lead.location], ['Message', lead.message],
  ].filter(([, v]) => v);
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
    <h2 style="margin:0 0 12px">New booking inquiry</h2>
    <table cellpadding="6" style="border-collapse:collapse;width:100%">
      ${rows.map(([k, v]) => `<tr><td style="color:#777;vertical-align:top;white-space:nowrap">${k}</td><td style="white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}
    </table>
    <p style="color:#777;font-size:12px;margin-top:16px">Reply to this email to answer ${esc(lead.full_name)} directly.</p></div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, reply_to: lead.email, subject: `New booking inquiry: ${lead.full_name}`, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

async function sendConfirmation(lead) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_FROM;
  if (!key || !from) return;
  const first = esc(lead.full_name.split(/\s+/)[0]);
  const rows = [['Event type', lead.event_type], ['Event date', lead.event_date], ['Location', lead.location]].filter(([, v]) => v);
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#111">
    <h2 style="margin:0 0 12px">We got your inquiry</h2>
    <p>Hi ${first},</p>
    <p>Thank you for reaching out to Taj Mahal. Your booking inquiry came through, and Taj's team will be in touch within 24 to 48 hours.</p>
    ${rows.length ? `<p style="margin:16px 0 6px;color:#777">What you sent us</p>
    <table cellpadding="6" style="border-collapse:collapse;width:100%">
      ${rows.map(([k, v]) => `<tr><td style="color:#777;white-space:nowrap">${k}</td><td>${esc(v)}</td></tr>`).join('')}
    </table>` : ''}
    <p>If you need to add anything, just reply to this email.</p>
    <p>Taj Mahal<br><span style="color:#777">Connect@iamtajmahal.com</span></p></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [lead.email], reply_to: 'Connect@iamtajmahal.com', subject: 'We got your inquiry', html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }
  const body = await readBody(req);

  // honeypot: real visitors never fill this hidden field; pretend success to bots
  if (body.website) return res.status(200).json({ ok: true });

  const lead = clean(body);
  if (!lead.full_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return res.status(400).json({ ok: false, error: 'Please enter your name and a valid email.' });
  }

  let stored = false, emailed = false, id = null;
  try {
    const sql = await db();
    const rows = await sql`
      INSERT INTO leads (full_name, email, phone, company, event_type, event_date, budget, location, message)
      VALUES (${lead.full_name}, ${lead.email}, ${lead.phone}, ${lead.company}, ${lead.event_type}, ${lead.event_date}, ${lead.budget}, ${lead.location}, ${lead.message})
      RETURNING id`;
    id = rows[0].id; stored = true;
  } catch (e) { console.error('lead store failed:', e.message); }

  try { await sendEmail(lead); emailed = true; } catch (e) { console.error('lead email failed:', e.message); }

  // confirmation to the sender; never blocks or fails the submission
  try { await sendConfirmation(lead); } catch (e) { console.error('confirmation email failed:', e.message); }

  if (stored && emailed) {
    try { const sql = await db(); await sql`UPDATE leads SET emailed = true WHERE id = ${id}`; } catch (e) { /* non-fatal */ }
  }

  // the lead counts as received if it reached either the portal or the inbox
  if (stored || emailed) return res.status(200).json({ ok: true });
  return res.status(502).json({ ok: false, error: 'Could not send right now.' });
};
