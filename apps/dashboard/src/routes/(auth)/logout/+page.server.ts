import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

/**
 * DEV AUTH BYPASS — temporary, must never be merged or deployed.
 *
 * When AUTH_BYPASS is enabled, the dev_user cookie is the only session, so
 * logout must clear it here. The client-side authClient.signOut() in
 * +page.svelte still runs but is a no-op without a Better Auth session.
 */
export const load: PageServerLoad = async ({ cookies }) => {
  if (env.AUTH_BYPASS === 'true') {
    cookies.delete('classroomio.dev_user', { path: '/' });
  }

  return {};
};