import { del } from '@vercel/blob';
import { adminSession, clearAdminCookie, createAdminCookie, validAdminCredentials } from '../lib/auth.js';
import { assertSameOrigin, errorResponse, HttpError, json, readJson, safeText } from '../lib/http.js';
import { deleteConfirmation, deleteGift, listAdminData, releaseGift, saveGift } from '../lib/db.js';

function requireAdmin(request) {
  const session = adminSession(request);
  if (!session) throw new HttpError(401, 'Faça login para acessar o painel.');
  return session;
}

async function removeBlob(url) {
  if (!url) return;
  try { await del(url); } catch (error) { console.error('Não foi possível remover a imagem antiga:', error); }
}

function giftInput(body) {
  const name = safeText(body.name, 120);
  const price = Number(body.price);
  const reservationLimit = Number.parseInt(body.reservationLimit, 10);
  if (!name || !Number.isFinite(price) || price <= 0 || !Number.isInteger(reservationLimit) || reservationLimit < 1 || reservationLimit > 50) {
    throw new HttpError(400, 'Informe nome, valor e limite de escolhas corretamente.');
  }
  const imageUrl = safeText(body.imageUrl, 2000);
  const imagePathname = safeText(body.imagePathname, 500);
  if ((imageUrl && !/^https:\/\//.test(imageUrl)) || (imagePathname && !imagePathname.startsWith('gifts/'))) {
    throw new HttpError(400, 'A imagem do presente é inválida.');
  }
  return { id: safeText(body.id, 100), name, price, reservationLimit, icon: safeText(body.icon, 8) || '✦', imageUrl, imagePathname };
}

export default {
  async fetch(request) {
    try {
      if (request.method === 'GET') {
        requireAdmin(request);
        return json(await listAdminData());
      }
      if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
      assertSameOrigin(request);
      const body = await readJson(request);
      if (body.action === 'login') {
        const username = safeText(body.username, 80);
        if (!validAdminCredentials(username, String(body.password ?? ''))) {
          throw new HttpError(401, 'Usuário ou senha incorretos.');
        }
        return json({ ok: true }, 200, { 'Set-Cookie': createAdminCookie(username) });
      }
      if (body.action === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': clearAdminCookie() });
      requireAdmin(request);
      if (body.action === 'saveGift') {
        const before = body.id ? (await listAdminData()).gifts.find((item) => item.id === body.id) : null;
        const saved = await saveGift(giftInput(body));
        if (before?.image_url && before.image_pathname !== saved.image_pathname) await removeBlob(before.image_url);
        return json({ ok: true, gift: saved });
      }
      if (body.action === 'releaseGift') return json({ ok: true, gift: await releaseGift(safeText(body.id, 100)) });
      if (body.action === 'deleteGift') {
        const deleted = await deleteGift(safeText(body.id, 100));
        await removeBlob(deleted.image_url);
        return json({ ok: true });
      }
      if (body.action === 'deleteConfirmation') return json({ ok: true, confirmation: await deleteConfirmation(safeText(body.id, 100)) });
      throw new HttpError(400, 'Ação inválida.');
    } catch (error) {
      return errorResponse(error);
    }
  },
};
