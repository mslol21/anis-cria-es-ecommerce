import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DATABASE_URL = process.env.DATABASE_URL || '';

async function main() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured in .env.local');
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

  try {
    const migrationsDir = path.resolve('supabase/migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`Migration ${file} applied successfully.`);
    }

    const { rows: tables } = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    console.log(`Total public tables verified: ${tables.length}`);
    for (const t of tables) {
      console.log(` - ${t.tablename} (RLS enabled: ${t.rowsecurity})`);
    }
  } finally {
    await client.end();
  }

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const restUrl = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/products?select=id,name,slug,sku,product_type,price_cents,stock_quantity&order=created_at.asc`;
    const resp = await fetch(restUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Supabase REST query failed (${resp.status}): ${errText}`);
    }

    const products = await resp.json();
    console.log(
      `Supabase PostgREST API verified! Fetched ${products.length} products from live Supabase DB:`
    );
    for (const p of products) {
      console.log(` * [${p.sku}] ${p.name} (${p.product_type}) - ${p.price_cents} cents`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
