import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { authServerClient } from './server';
import { classroomio } from '$lib/utils/services/api';
import { getCioCookieString } from '$lib/utils/functions/cookies';

/**
 * DEV AUTH BYPASS — temporary, must never be merged or deployed.
 *
 * When AUTH_BYPASS is enabled on the API, the dashboard can resolve its
 * locals from the API's /session endpoint by forwarding the signed dev_user
 * cookie set by the dev account picker, without any Better Auth cookies.
 */
async function getThroughDevBypass(cookies: Cookies): Promise<App.Locals | null> {
  try {
    const devCookie = cookies.get('classroomio.dev_user');

    if (!devCookie) return null;

    const session = await classroomio.session.$get(undefined, {
      headers: {
        cookie: `classroomio.dev_user=${encodeURIComponent(devCookie)}`
      }
    });
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
    // DEV AUTH BYPASS — forward the signed dev_user cookie.
    if (env.AUTH_BYPASS === 'true') {
      const bypassLocals = await getThroughDevBypass(cookies);
      if (bypassLocals) {
        return bypassLocals;
      }
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
