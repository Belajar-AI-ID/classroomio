import { describe, expect, it } from 'vitest';

import { SSO_PROVIDERS, ZCreateSsoConnection } from '../src/validation/organization/sso';

describe('SSO provider validation', () => {
  it('supports Clerk as a generic OIDC provider', () => {
    expect(SSO_PROVIDERS).toContain('CLERK');

    const result = ZCreateSsoConnection.parse({
      provider: 'CLERK',
      displayName: 'BelajarAI Clerk',
      issuer: 'https://clerk.belajarai.id',
      domain: 'belajarai.id',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      scopes: 'openid profile email'
    });

    expect(result.provider).toBe('CLERK');
    expect(result.scopes).toBe('openid profile email');
  });

  it('keeps OIDC issuer and client credentials required for Clerk', () => {
    const result = ZCreateSsoConnection.safeParse({
      provider: 'CLERK',
      displayName: 'BelajarAI Clerk',
      domain: 'belajarai.id',
      clientId: '',
      clientSecret: ''
    });

    expect(result.success).toBe(false);
  });
});
