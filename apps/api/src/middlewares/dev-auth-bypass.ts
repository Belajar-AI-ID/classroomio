import { getUserByEmail } from '@cio/db/queries/auth';
import { getUserOrgRolesMap } from '@cio/db/queries/organization';

/**
 * DEV AUTH BYPASS — temporary, must never be merged or deployed.
 *
 * When AUTH_BYPASS is enabled, every request is impersonated as the user
 * identified by AUTH_BYPASS_EMAIL (default: the seeded admin account), so the
 * dashboard and API can be browsed without signing in through Better Auth.
 *
 * Roles and permissions follow the real user: org/course middlewares keep
 * enforcing the impersonated user's actual memberships.
 *
 * Enable by setting in apps/api/.env and apps/dashboard/.env:
 *   AUTH_BYPASS=true
 *   AUTH_BYPASS_EMAIL=admin@test.com
 */

const BYPASS_EMAIL = process.env.AUTH_BYPASS_EMAIL || 'admin@test.com';

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

let cachedBypassSession: BypassSession | null = null;
let bypassResolutionFailed = false;

export function isDevAuthBypassEnabled(): boolean {
  return process.env.AUTH_BYPASS === 'true';
}

/**
 * Builds the synthetic session for the bypass user. Memoized per process —
 * the DB is read once, not on every request.
 */
export async function getDevBypassSession(): Promise<BypassSession | null> {
  if (!isDevAuthBypassEnabled()) return null;

  if (cachedBypassSession) return cachedBypassSession;
  if (bypassResolutionFailed) return null;

  const user = await getUserByEmail(BYPASS_EMAIL);
  if (!user) {
    bypassResolutionFailed = true;
    console.error(
      `[dev-auth-bypass] AUTH_BYPASS_EMAIL "${BYPASS_EMAIL}" not found in the user table. ` +
        'Fix AUTH_BYPASS_EMAIL in apps/api/.env or disable AUTH_BYPASS.'
    );

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

  cachedBypassSession = {
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

  console.log(`[dev-auth-bypass] active — impersonating ${BYPASS_EMAIL} (${user.id})`);

  return cachedBypassSession;
}