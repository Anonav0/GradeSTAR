import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, type DbClient } from '@gradestar/database';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';

describe('Languages API (/api/v1/languages)', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });
  const app = createApp({ logger });

  const testPrefix = `langtest-${Date.now()}`;
  let disabledLangId: string;
  let customEnabledLangId: string;

  beforeAll(async () => {
    // 1. Create a disabled test language
    const disabled = await prisma.language.create({
      data: {
        name: `Disabled Lang ${testPrefix}`,
        slug: `${testPrefix}-disabled`,
        version: '0.1-alpha',
        isEnabled: false,
      },
    });
    disabledLangId = disabled.id;

    // 2. Create an enabled test language
    const enabled = await prisma.language.create({
      data: {
        name: `Custom Lang ${testPrefix}`,
        slug: `${testPrefix}-custom`,
        version: '2.0',
        isEnabled: true,
      },
    });
    customEnabledLangId = enabled.id;
  });

  afterAll(async () => {
    await prisma.language.deleteMany({
      where: {
        id: { in: [disabledLangId, customEnabledLangId] },
      },
    });
  });

  it('allows anonymous callers to retrieve enabled languages without authentication', async () => {
    const res = await request(app).get('/api/v1/languages');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it('returns enabled languages and strictly excludes disabled languages', async () => {
    const res = await request(app).get('/api/v1/languages');
    expect(res.status).toBe(200);

    const items = res.body.data.items;
    const slugs = items.map((l: { slug: string }) => l.slug);

    // Enabled language must be present
    expect(slugs).toContain(`${testPrefix}-custom`);

    // Disabled language must NOT be present
    expect(slugs).not.toContain(`${testPrefix}-disabled`);
  });

  it('returns only public language fields and excludes internal identifiers or timestamps', async () => {
    const res = await request(app).get('/api/v1/languages');
    expect(res.status).toBe(200);

    const targetLang = res.body.data.items.find(
      (l: { slug: string }) => l.slug === `${testPrefix}-custom`,
    );
    expect(targetLang).toBeDefined();

    // Required public fields
    expect(targetLang).toEqual({
      name: `Custom Lang ${testPrefix}`,
      slug: `${testPrefix}-custom`,
      version: '2.0',
    });

    // Prohibited internal fields
    expect(targetLang).not.toHaveProperty('id');
    expect(targetLang).not.toHaveProperty('isEnabled');
    expect(targetLang).not.toHaveProperty('createdAt');
    expect(targetLang).not.toHaveProperty('updatedAt');
  });

  it('orders enabled languages deterministically by name ascending', async () => {
    const res = await request(app).get('/api/v1/languages');
    expect(res.status).toBe(200);

    const names = res.body.data.items.map((l: { name: string }) => l.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });

  it('returns empty collection when no enabled languages exist in the database', async () => {
    const emptyDb = {
      language: {
        findMany: async () => [],
      },
    } as unknown as DbClient;

    const emptyApp = createApp({ logger, db: emptyDb });
    const res = await request(emptyApp).get('/api/v1/languages');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toEqual([]);
  });

  it('handles unexpected database failure gracefully via centralized error handler', async () => {
    const errorDb = {
      language: {
        findMany: async () => {
          throw new Error('Database connection reset by peer');
        },
      },
    } as unknown as DbClient;

    const errorApp = createApp({ logger, db: errorDb });
    const res = await request(errorApp).get('/api/v1/languages');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('statusCode', 500);
    expect(res.body).toHaveProperty('timestamp');
  });
});
