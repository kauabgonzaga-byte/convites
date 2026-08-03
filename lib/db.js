import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { HttpError } from './http.js';

let initialized = null;

function sql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('Defina DATABASE_URL nas variáveis da Vercel.');
  return neon(url);
}

function number(value) {
  return Number(value);
}

function gift(record) {
  return { ...record, price: number(record.price), reservation_limit: number(record.reservation_limit), reservation_count: number(record.reservation_count) };
}

async function ensureSchema() {
  if (!initialized) {
    initialized = (async () => {
      const query = sql();
      await query`CREATE TABLE IF NOT EXISTS gifts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price NUMERIC(10,2) NOT NULL CHECK (price > 0),
        icon TEXT NOT NULL DEFAULT '✦',
        image_url TEXT NOT NULL DEFAULT '',
        image_pathname TEXT NOT NULL DEFAULT '',
        reservation_limit INTEGER NOT NULL DEFAULT 1 CHECK (reservation_limit BETWEEN 1 AND 50),
        reservation_count INTEGER NOT NULL DEFAULT 0 CHECK (reservation_count >= 0),
        status TEXT NOT NULL DEFAULT 'available',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`CREATE TABLE IF NOT EXISTS confirmations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        attendance TEXT NOT NULL CHECK (attendance IN ('sim', 'nao')),
        adults INTEGER NOT NULL DEFAULT 0,
        children INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        gift_id TEXT NOT NULL DEFAULT '',
        gift_name TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`CREATE INDEX IF NOT EXISTS confirmations_gift_id_idx ON confirmations(gift_id)`;
      await query`INSERT INTO gifts (id, name, price, icon) VALUES
        ('cesto', 'Cesto dobrável', 42.90, '⌁'),
        ('tapete', 'Tapete para o banho', 66.50, '▧'),
        ('potes', 'Conjunto de potes', 75.80, '◌'),
        ('escorredor', 'Escorredor de louças', 82.40, '⌇'),
        ('passadeira', 'Passadeira para cozinha', 95.70, '▤'),
        ('facas', 'Jogo de facas', 130.20, '†'),
        ('pipoqueira', 'Pipoqueira elétrica', 144.80, '◒'),
        ('fondue', 'Aparelho para fondue', 160.90, '♨'),
        ('chaleira', 'Chaleira elétrica', 189.00, '♨'),
        ('ferro', 'Ferro a vapor', 190.10, '⌁'),
        ('tacas', 'Taças para brindar', 217.90, '♕'),
        ('frigideiras', 'Conjunto de frigideiras', 226.70, '◉')
        ON CONFLICT (id) DO NOTHING`;
    })().catch((error) => { initialized = null; throw error; });
  }
  return initialized;
}

export async function listGifts() {
  await ensureSchema();
  return (await sql()`SELECT * FROM gifts ORDER BY created_at ASC`).map(gift);
}

export async function listAdminData() {
  await ensureSchema();
  const query = sql();
  const [gifts, confirmations] = await Promise.all([
    query`SELECT * FROM gifts ORDER BY created_at ASC`,
    query`SELECT * FROM confirmations ORDER BY created_at DESC`,
  ]);
  const normalizedGifts = gifts.map(gift);
  const confirmed = confirmations.filter((item) => item.attendance === 'sim');
  return {
    gifts: normalizedGifts,
    confirmations,
    stats: {
      gifts: normalizedGifts.length,
      reserved: normalizedGifts.filter((item) => item.reservation_count > 0).length,
      confirmations: confirmations.length,
      guests: confirmed.reduce((total, item) => total + number(item.adults) + number(item.children), 0),
    },
  };
}

export async function saveGift(input) {
  await ensureSchema();
  const query = sql();
  if (input.id) {
    const rows = await query`UPDATE gifts SET name=${input.name}, price=${input.price}, icon=${input.icon}, image_url=${input.imageUrl}, image_pathname=${input.imagePathname}, reservation_limit=${input.reservationLimit}, status=CASE WHEN reservation_count >= ${input.reservationLimit} THEN 'reserved' ELSE 'available' END, updated_at=NOW() WHERE id=${input.id} AND reservation_count <= ${input.reservationLimit} RETURNING *`;
    if (!rows[0]) throw new HttpError(400, 'Não é possível reduzir o limite abaixo das escolhas já registradas.');
    return gift(rows[0]);
  }
  const id = `gift-${randomUUID()}`;
  const rows = await query`INSERT INTO gifts (id, name, price, icon, image_url, image_pathname, reservation_limit) VALUES (${id}, ${input.name}, ${input.price}, ${input.icon}, ${input.imageUrl}, ${input.imagePathname}, ${input.reservationLimit}) RETURNING *`;
  return gift(rows[0]);
}

export async function releaseGift(id) {
  await ensureSchema();
  const rows = await sql()`UPDATE gifts SET reservation_count=0, status='available', updated_at=NOW() WHERE id=${id} RETURNING *`;
  if (!rows[0]) throw new HttpError(404, 'Presente não encontrado.');
  return gift(rows[0]);
}

export async function deleteGift(id) {
  await ensureSchema();
  const rows = await sql()`DELETE FROM gifts WHERE id=${id} RETURNING *`;
  if (!rows[0]) throw new HttpError(404, 'Presente não encontrado.');
  return gift(rows[0]);
}

export async function deleteConfirmation(id) {
  await ensureSchema();
  const rows = await sql()`DELETE FROM confirmations WHERE id=${id} RETURNING *`;
  if (!rows[0]) throw new HttpError(404, 'Confirmação não encontrada.');
  return rows[0];
}

export async function saveConfirmation(input) {
  await ensureSchema();
  const query = sql();
  const id = randomUUID();
  if (!input.giftId) {
    const rows = await query`INSERT INTO confirmations (id, name, email, phone, attendance, adults, children, note) VALUES (${id}, ${input.name}, ${input.email}, ${input.phone}, ${input.attendance}, ${input.adults}, ${input.children}, ${input.note}) RETURNING *`;
    return rows[0];
  }
  const rows = await query`WITH reserved AS (
      UPDATE gifts SET reservation_count=reservation_count + 1, status=CASE WHEN reservation_count + 1 >= reservation_limit THEN 'reserved' ELSE 'available' END, updated_at=NOW()
      WHERE id=${input.giftId} AND reservation_count < reservation_limit
      RETURNING name
    ), saved AS (
      INSERT INTO confirmations (id, name, email, phone, attendance, adults, children, note, gift_id, gift_name)
      SELECT ${id}, ${input.name}, ${input.email}, ${input.phone}, ${input.attendance}, ${input.adults}, ${input.children}, ${input.note}, ${input.giftId}, name FROM reserved
      RETURNING *
    ) SELECT * FROM saved`;
  if (!rows[0]) throw new HttpError(409, 'Este presente já atingiu o limite de escolhas. Selecione outro item.');
  return rows[0];
}
