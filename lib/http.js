export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export async function readJson(request) {
  try {
    const value = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error();
    }
    return value;
  } catch {
    throw new HttpError(400, 'Dados enviados em formato inválido.');
  }
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return;
  try {
    if (new URL(origin).host !== host) {
      throw new HttpError(403, 'Origem da solicitação não permitida.');
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, 'Origem da solicitação não permitida.');
  }
}

export function safeText(value, maximum = 255) {
  return String(value ?? '').trim().slice(0, maximum);
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status);
  }
  console.error(error);
  return json({ error: 'Não foi possível concluir a solicitação. Tente novamente.' }, 500);
}
