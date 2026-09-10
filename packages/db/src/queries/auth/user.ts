import * as schema from '@db/schema';

import type { TUser } from '@db/types';
import { db } from '@db/drizzle';
import { eq } from 'drizzle-orm';

/**
 * Dev-only auth bypass support: fetch a Better Auth user row by email.
 */
export async function getUserByEmail(email: string): Promise<TUser | null> {
  try {
    const [user] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);

    return user ?? null;
  } catch (error) {
    console.error('getUserByEmail error:', error);
    throw new Error('Failed to fetch user by email');
  }
}