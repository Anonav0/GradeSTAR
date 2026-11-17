import * as argon2 from 'argon2';

/**
 * Standard Argon2id configuration parameters adhering to OWASP recommendations.
 * Memory cost: 64 MB (65536 KB)
 * Time cost / iterations: 3
 * Parallelism: 4 threads
 */
export const ARGON2_OPTIONS: argon2.HashOptions & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  raw: false,
};

/**
 * Hashes a plaintext password using Argon2id.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, ARGON2_OPTIONS);
}

/**
 * Verifies a plaintext candidate against a stored Argon2id password hash.
 */
export async function verifyPassword(
  storedHash: string,
  candidatePassword: string,
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, candidatePassword);
  } catch {
    return false;
  }
}
