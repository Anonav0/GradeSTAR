import { describe, it, expect } from 'vitest';
import { validateEnv } from '../src/config/env.js';

describe('API Environment Variable Validation', () => {
  it('validates default development environment successfully', () => {
    const env = validateEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.REDIS_URL).toContain('redis://');
  });

  it('parses valid custom ports', () => {
    const env = validateEnv({ API_PORT: '5001' });
    expect(env.API_PORT).toBe(5001);
  });

  it('throws descriptive error on invalid port', () => {
    expect(() => validateEnv({ API_PORT: 'invalid-port' })).toThrow(
      'API_PORT must be a valid integer',
    );
  });

  it('throws descriptive error on invalid DATABASE_URL', () => {
    expect(() => validateEnv({ DATABASE_URL: 'not-a-url' })).toThrow(
      'DATABASE_URL must be a valid connection URL',
    );
  });

  it('throws descriptive error on invalid REDIS_URL', () => {
    expect(() => validateEnv({ REDIS_URL: 'not-a-url' })).toThrow(
      'REDIS_URL must be a valid connection URL',
    );
  });
});
