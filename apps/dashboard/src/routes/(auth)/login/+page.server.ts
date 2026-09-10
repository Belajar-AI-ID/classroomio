import { createHmac } from 'crypto';

import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * DEV AUTH BYPASS — temporary, must never be merged or deployed.
 *
 * When AUTH_BYPASS is enabled, the login page renders a dev account picker
 * instead of the email/password form. Picking an account sets a signed
 * `classroomio.dev_user` cookie that the API's bypass middleware verifies.
 */

const DEV_COOKIE_NAME = 'classroomio.dev_user';
const DEV_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, mirrors API bypass session

function signDevUserCookie(email: string): string {
  const key = process.env.PRIVATE_SERVER_KEY || '';

  return `${email}.${createHmac('sha256', key).update(email).digest('hex')}`;
}

export const load: PageServerLoad = async () => {
  return {
    authBypass: env.AUTH_BYPASS === 'true'
  };
};

export const actions: Actions = {
  'dev-login': async ({ request, cookies }) => {
    if (env.AUTH_BYPASS !== 'true') {
      return redirect(303, '/login');
    }

    const formData = await request.formData();
    const email = String(formData.get('email') || '').trim();

    if (!email) {
      return { success: false, error: 'Email is required' };
    }

    cookies.set(DEV_COOKIE_NAME, signDevUserCookie(email), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: DEV_COOKIE_MAX_AGE
    });

    return redirect(303, '/');
  }
};