import { describe, it, expect } from 'vitest';
import { validateEnv } from '../src/config/env.js';

describe('API Environment Variable Validation', () => {
  it('validates default development environment successfully', () => {
    const env = validateEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(4000);
    expect(env.PORT).toBe(4000);
    expect(env.port).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.REDIS_URL).toContain('redis://');
  });

  it('parses valid custom API_PORT and PORT', () => {
    const envApiPort = validateEnv({ API_PORT: '5001' });
    expect(envApiPort.API_PORT).toBe(5001);
    expect(envApiPort.port).toBe(5001);

    const envPort = validateEnv({ PORT: '5002' });
    expect(envPort.PORT).toBe(5002);
    expect(envPort.port).toBe(5002);
  });

  it('throws descriptive error on invalid port', () => {
    expect(() => validateEnv({ API_PORT: 'invalid-port' })).toThrow(
      'API_PORT must be a valid integer',
    );
    expect(() => validateEnv({ PORT: '70000' })).toThrow('PORT must be between 0 and 65535');
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

  it('requires DATABASE_URL in production environment', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
      'DATABASE_URL is required in production environment',
    );

    const validProd = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://prod_user:secret@db.prod.internal:5432/gradestar',
    });
    expect(validProd.NODE_ENV).toBe('production');
    expect(validProd.DATABASE_URL).toBe(
      'postgresql://prod_user:secret@db.prod.internal:5432/gradestar',
    );
  });
});
