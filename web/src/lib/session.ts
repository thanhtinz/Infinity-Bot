import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const SESSION_COOKIE = 'infinity_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return token;
}

function hashToken(token: string): string {
  // Store a hash, not the raw token, so a DB leak alone can't be replayed as a cookie.
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function destroySessionToken(token: string | undefined) {
  if (!token) return;
  await prisma.session.delete({ where: { id: hashToken(token) } }).catch(() => {});
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return getUserFromToken(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  await destroySessionToken(token);
  cookieStore.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };
