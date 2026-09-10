import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { authServerClient } from './server';
import { classroomio } from '$lib/utils/services/api';
import { getCioCookieString } from '$lib/utils/functions/cookies';

/**
 * DEV AUTH BYPASS — temporary, must never be merged or deployed.
 *
 * When AUTH_BYPASS is enabled on the API, the dashboard can resolve its
 * locals from the API's /session endpoint without any Better Auth cookies,
 * so pages render as AUTH_BYPASS_EMAIL without signing in.
 */
async function getThroughDevBypass(): Promise<App.Locals | null> {
  try {
    const session = await classroomio.session.$get();
    const data = (await session.json()) as App.Locals & { orgRoles?: Record<string, number> };

    if (!data?.user) return null;

    return { ...data, orgRoles: data.orgRoles ?? {} } as App.Locals;
  } catch (error) {
    console.error('[dev-auth-bypass] dashboard session lookup failed:', error);
    return null;
  }
}

export const getSessionData = async (cookies: Cookies): Promise<App.Locals | null> => {
  try {
    // DEV AUTH BYPASS — skip Better Auth cookies entirely.
    if (env.AUTH_BYPASS === 'true') {
      const bypassLocals = await getThroughDevBypass();
      if (bypassLocals) {
        console.log('[dev-auth-bypass] dashboard using bypass session');
        return bypassLocals;
      }

      console.error('[dev-auth-bypass] enabled but API returned no session — check API logs');
    }

    const cioCookies = getCioCookieString(cookies);

    if (!cioCookies) return null;

    const locals = await getThroughAuthClient(cioCookies);
    console.log('has locals', !!locals);
    if (!locals) return null;

    // This will always be true because if we don't have classroomio cookies, we won't be able to this line of code.
    locals.fromSessions = true;

    return locals;
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
};

export async function getThroughTrpc(allCookies: string) {
  const session = await classroomio.session.$get(undefined, {
    headers: {
      cookie: allCookies
    }
  });

  const data = (await session.json()) as App.Locals;

  return data;
}

export async function getThroughAuthClient(allCookies: string) {
  const session = await authServerClient.getSession({
    fetchOptions: {
      headers: {
        cookie: allCookies
      }
    }
  });

  return session.data as App.Locals | null;
}
