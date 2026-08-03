import { assertSameOrigin, errorResponse, HttpError, json, readJson, safeText } from '../lib/http.js';
import { listGifts, saveConfirmation } from '../lib/db.js';

export default {
  async fetch(request) {
    try {
      if (request.method === 'GET') return json({ gifts: await listGifts() });
      if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
      assertSameOrigin(request);
      const body = await readJson(request);
      if (body.action !== 'rsvp') throw new HttpError(400, 'Ação inválida.');
      const name = safeText(body.name, 100);
      const phone = safeText(body.phone, 40);
      const attendance = body.attendance === 'nao' ? 'nao' : body.attendance === 'sim' ? 'sim' : '';
      const adults = attendance === 'nao' ? 0 : Math.max(1, Math.min(20, Number.parseInt(body.adults, 10) || 1));
      const children = attendance === 'nao' ? 0 : Math.max(0, Math.min(20, Number.parseInt(body.children, 10) || 0));
      if (!name || !phone || !attendance || body.consent !== true) {
        throw new HttpError(400, 'Preencha nome, telefone, presença e autorização corretamente.');
      }
      const confirmation = await saveConfirmation({ name, email: '', phone, attendance, adults, children, note: safeText(body.note, 500), giftId: safeText(body.giftId, 100) });
      const message = confirmation.gift_name
        ? confirmation.attendance === 'sim'
          ? `Obrigada! Sua presença e o presente “${confirmation.gift_name}” foram registrados.`
          : `Obrigada! O presente “${confirmation.gift_name}” foi registrado. Sentiremos sua falta na celebração.`
        : 'Obrigada! Sua confirmação foi registrada.';
      return json({ ok: true, message });
    } catch (error) {
      return errorResponse(error);
    }
  },
};
