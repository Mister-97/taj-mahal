const { neon } = require('@neondatabase/serverless');

let ready;

// Returns a tagged-template SQL client; creates the table on first use.
async function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = neon(url);
  if (!ready) {
    ready = sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        company TEXT,
        event_type TEXT,
        event_date TEXT,
        budget TEXT,
        location TEXT,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        notes TEXT NOT NULL DEFAULT '',
        emailed BOOLEAN NOT NULL DEFAULT false
      )`.catch((e) => { ready = null; throw e; });
  }
  await ready;
  return sql;
}

module.exports = { db };
