import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'wedding_admin_session';
const SESSION_SECONDS = 60 * 60 * 8;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres.');
  }
  return value;
}

function signature(value) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookieValue(request, name) {
  const cookies = request.headers.get('cookie') || '';
  const entry = cookies.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
}

export function validAdminCredentials(username, password) {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword) {
    throw new Error('Defina ADMIN_USERNAME e ADMIN_PASSWORD nas variáveis da Vercel.');
  }
  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword);
}

export function createAdminCookie(username) {
  const payload = base64url(JSON.stringify({ username, expiresAt: Date.now() + SESSION_SECONDS * 1000 }));
  const token = `${payload}.${signature(payload)}`;
  const secure = process.env.VERCEL ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearAdminCookie() {
  const secure = process.env.VERCEL ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function adminSession(request) {
  const token = cookieValue(request, COOKIE_NAME);
  const [payload, receivedSignature] = token.split('.');
  if (!payload || !receivedSignature || !safeEqual(signature(payload), receivedSignature)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.username === 'string' && Number(data.expiresAt) > Date.now() ? data : null;
  } catch {
    return null;
  }
}
