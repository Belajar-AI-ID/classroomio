import { createHmac, timingSafeEqual } from 'crypto';

import { getUserByEmail } from '@cio/db/queries/auth';
import { getUserOrgRolesMap } from '@cio/db/queries/organization';

/**
 * DEV AUTH BYPASS — temporary, must never be merged or deployed.
 *
 * When AUTH_BYPASS is enabled, requests carrying a valid signed dev cookie
 * (`classroomio.dev_user`, set by the dashboard's dev account picker) are
 * impersonated as that cookie's user. No Better Auth session is involved.
 *
 * Roles and permissions follow the real user: org/course middlewares keep
 * enforcing the impersonated user's actual memberships.
 *
 * Enable by setting in apps/api/.env and apps/dashboard/.env:
 *   AUTH_BYPASS=true
 */

const DEV_COOKIE_NAME = 'classroomio.dev_user';

type BypassSession = {
  user: Awaited<ReturnType<typeof getUserByEmail>>;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    token: string;
    ipAddress: string | null;
    userAgent: string | null;
  } | null;
  orgRoles: Record<string, number>;
};

/** Memoized synthetic sessions, keyed by impersonated user email. */
const bypassSessionCache = new Map<string, BypassSession>();

export function isDevAuthBypassEnabled(): boolean {
  return process.env.AUTH_BYPASS === 'true';
}

/** Signs a dev impersonation cookie value: `${email}.${hmac}`. */
export function signDevUserCookie(email: string): string {
  const key = process.env.PRIVATE_SERVER_KEY || '';

  return `${email}.${createHmac('sha256', key).update(email).digest('hex')}`;
}

function verifyDevUserCookie(value: string): string | null {
  const separatorIndex = value.lastIndexOf('.');
  if (separatorIndex === -1) return null;

  const email = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);
  const expected = signDevUserCookie(email);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected.slice(email.length + 1));

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  return email;
}

function extractCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }

  return null;
}

/**
 * Builds the synthetic session for the dev cookie's user. Memoized per
 * process — each impersonated user's DB rows are read once.
 */
export async function getDevBypassSession(cookieHeader: string | undefined): Promise<BypassSession | null> {
  if (!isDevAuthBypassEnabled()) return null;

  const cookieValue = extractCookie(cookieHeader, DEV_COOKIE_NAME);
  if (!cookieValue) return null;

  const email = verifyDevUserCookie(cookieValue);
  if (!email) {
    console.error('[dev-auth-bypass] invalid dev_user cookie signature — ignoring');
    return null;
  }

  const cached = bypassSessionCache.get(email);
  if (cached) return cached;

  const user = await getUserByEmail(email);
  if (!user) {
    console.error(`[dev-auth-bypass] dev_user cookie email "${email}" not found in the user table.`);
    return null;
  }

  let orgRoles: Record<string, number> = {};
  try {
    orgRoles = await getUserOrgRolesMap(user.id);
  } catch (error) {
    console.error('[dev-auth-bypass] failed to load orgRoles, continuing with empty roles:', error);
  }

  const now = new Date();
  const farFuture = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

  const bypassSession: BypassSession = {
    user,
    session: {
      id: `dev-bypass-${user.id}`,
      userId: user.id,
      token: 'dev-bypass-token',
      expiresAt: farFuture,
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: 'dev-auth-bypass'
    },
    orgRoles
  };

  bypassSessionCache.set(email, bypassSession);

  return bypassSession;
}