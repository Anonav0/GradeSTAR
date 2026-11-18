import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, ProblemDifficulty } from '@gradestar/database';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';

describe('Problem Listing API (/api/v1/problems)', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });
  const app = createApp({ logger });

  const testPrefix = `plist-${Date.now()}`;

  // Created test problem IDs for cleanup
  const createdProblemIds: string[] = [];

  beforeAll(async () => {
    // 1. Create a set of controlled test problems
    // 3 published EASY problems
    for (let i = 1; i <= 3; i++) {
      const p = await prisma.problem.create({
        data: {
          slug: `${testPrefix}-easy-${i}`,
          title: `Alpha Easy ${testPrefix} Problem ${i}`,
          statement: `Statement for easy problem ${i}`,
          difficulty: ProblemDifficulty.EASY,
          inputDescription: 'Input info',
          outputDescription: 'Output info',
          timeLimitMs: 1000,
          memoryLimitMb: 256,
          isPublished: true,
          createdAt: new Date(Date.now() - (10 - i) * 1000), // deterministic timestamps
        },
      });
      createdProblemIds.push(p.id);
    }

    // 2 published MEDIUM problems
    for (let i = 1; i <= 2; i++) {
      const p = await prisma.problem.create({
        data: {
          slug: `${testPrefix}-med-${i}`,
          title: `Beta Medium ${testPrefix} Problem ${i}`,
          statement: `Statement for medium problem ${i}`,
          difficulty: ProblemDifficulty.MEDIUM,
          inputDescription: 'Input info',
          outputDescription: 'Output info',
          timeLimitMs: 2000,
          memoryLimitMb: 512,
          isPublished: true,
          createdAt: new Date(Date.now() - (20 - i) * 1000),
        },
      });
      createdProblemIds.push(p.id);
    }

    // 1 published HARD problem
    const hardProblem = await prisma.problem.create({
      data: {
        slug: `${testPrefix}-hard-1`,
        title: `Gamma Hard ${testPrefix} Problem 1`,
        statement: `Statement for hard problem 1`,
        difficulty: ProblemDifficulty.HARD,
        inputDescription: 'Input info',
        outputDescription: 'Output info',
        timeLimitMs: 3000,
        memoryLimitMb: 512,
        isPublished: true,
        createdAt: new Date(),
      },
    });
    createdProblemIds.push(hardProblem.id);

    // 2 UNPUBLISHED problems (one EASY, one HARD)
    const unpubEasy = await prisma.problem.create({
      data: {
        slug: `${testPrefix}-unpub-easy`,
        title: `Unpublished Easy ${testPrefix} Problem`,
        statement: `Private draft statement`,
        difficulty: ProblemDifficulty.EASY,
        inputDescription: 'Input info',
        outputDescription: 'Output info',
        timeLimitMs: 1000,
        memoryLimitMb: 256,
        isPublished: false,
      },
    });
    createdProblemIds.push(unpubEasy.id);

    const unpubHard = await prisma.problem.create({
      data: {
        slug: `${testPrefix}-unpub-hard`,
        title: `Unpublished Hard ${testPrefix} Problem`,
        statement: `Private draft statement`,
        difficulty: ProblemDifficulty.HARD,
        inputDescription: 'Input info',
        outputDescription: 'Output info',
        timeLimitMs: 3000,
        memoryLimitMb: 512,
        isPublished: false,
      },
    });
    createdProblemIds.push(unpubHard.id);
  });

  afterAll(async () => {
    if (createdProblemIds.length > 0) {
      await prisma.problem.deleteMany({
        where: { id: { in: createdProblemIds } },
      });
    }
  });

  it('allows anonymous public access without authentication headers or cookies', async () => {
    const res = await request(app).get('/api/v1/problems');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
  });

  it('returns only published problems and strictly excludes unpublished drafts', async () => {
    const res = await request(app).get(`/api/v1/problems?q=${testPrefix}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const items = res.body.data.items;
    // Exactly 6 published test problems (3 easy + 2 med + 1 hard)
    expect(items.length).toBe(6);
    expect(res.body.data.pagination.total).toBe(6);

    // Ensure no unpublished slugs appear
    const slugs = items.map((p: { slug: string }) => p.slug);
    expect(slugs).not.toContain(`${testPrefix}-unpub-easy`);
    expect(slugs).not.toContain(`${testPrefix}-unpub-hard`);
  });

  it('filters published problems by difficulty enum', async () => {
    // EASY filter
    const easyRes = await request(app).get(`/api/v1/problems?q=${testPrefix}&difficulty=EASY`);
    expect(easyRes.status).toBe(200);
    expect(easyRes.body.data.items.length).toBe(3);
    expect(easyRes.body.data.pagination.total).toBe(3);
    for (const item of easyRes.body.data.items) {
      expect(item.difficulty).toBe(ProblemDifficulty.EASY);
      expect(item.slug).not.toBe(`${testPrefix}-unpub-easy`);
    }

    // MEDIUM filter
    const medRes = await request(app).get(`/api/v1/problems?q=${testPrefix}&difficulty=MEDIUM`);
    expect(medRes.status).toBe(200);
    expect(medRes.body.data.items.length).toBe(2);
    expect(medRes.body.data.pagination.total).toBe(2);

    // HARD filter
    const hardRes = await request(app).get(`/api/v1/problems?q=${testPrefix}&difficulty=HARD`);
    expect(hardRes.status).toBe(200);
    expect(hardRes.body.data.items.length).toBe(1);
    expect(hardRes.body.data.pagination.total).toBe(1);
    expect(hardRes.body.data.items[0].slug).toBe(`${testPrefix}-hard-1`);
  });

  it('applies pagination with skip and take correctly', async () => {
    // Page 1 with limit 2
    const page1Res = await request(app).get(
      `/api/v1/problems?q=${testPrefix}&page=1&limit=2&sortBy=title&sortOrder=asc`,
    );
    expect(page1Res.status).toBe(200);
    expect(page1Res.body.data.items.length).toBe(2);
    expect(page1Res.body.data.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 6,
      totalPages: 3,
    });

    // Page 2 with limit 2
    const page2Res = await request(app).get(
      `/api/v1/problems?q=${testPrefix}&page=2&limit=2&sortBy=title&sortOrder=asc`,
    );
    expect(page2Res.status).toBe(200);
    expect(page2Res.body.data.items.length).toBe(2);
    expect(page2Res.body.data.pagination.page).toBe(2);

    // Items on page 1 and page 2 must be distinct
    const slugsPage1 = page1Res.body.data.items.map((i: { slug: string }) => i.slug);
    const slugsPage2 = page2Res.body.data.items.map((i: { slug: string }) => i.slug);
    for (const slug of slugsPage1) {
      expect(slugsPage2).not.toContain(slug);
    }
  });

  it('handles page requests beyond total count without error (returns empty items)', async () => {
    const res = await request(app).get(`/api/v1/problems?q=${testPrefix}&page=999&limit=10`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.pagination.page).toBe(999);
    expect(res.body.data.pagination.total).toBe(6);
    expect(res.body.data.pagination.totalPages).toBe(1);
  });

  it('returns valid empty collection when no problems match the filters', async () => {
    const res = await request(app).get(`/api/v1/problems?q=nonexistent-search-query-xyz-123`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it('does not expose problem statement, test cases, or internal IDs in listing responses', async () => {
    const res = await request(app).get(`/api/v1/problems?q=${testPrefix}`);
    expect(res.status).toBe(200);
    const item = res.body.data.items[0];

    // Allowed public discovery fields
    expect(item).toHaveProperty('slug');
    expect(item).toHaveProperty('title');
    expect(item).toHaveProperty('difficulty');
    expect(item).toHaveProperty('createdAt');

    // Forbidden in listing
    expect(item).not.toHaveProperty('statement');
    expect(item).not.toHaveProperty('testCases');
    expect(item).not.toHaveProperty('sampleTestCases');
    expect(item).not.toHaveProperty('submissions');
    expect(item).not.toHaveProperty('isPublished');
    expect(item).not.toHaveProperty('inputDescription');
    expect(item).not.toHaveProperty('outputDescription');
  });

  it('sorts deterministically by allowlisted fields', async () => {
    // Sort by title asc
    const titleAscRes = await request(app).get(
      `/api/v1/problems?q=${testPrefix}&sortBy=title&sortOrder=asc`,
    );
    expect(titleAscRes.status).toBe(200);
    const titles = titleAscRes.body.data.items.map((p: { title: string }) => p.title);
    const sortedTitles = [...titles].sort((a, b) => a.localeCompare(b));
    expect(titles).toEqual(sortedTitles);

    // Sort by createdAt desc (default)
    const createdDescRes = await request(app).get(
      `/api/v1/problems?q=${testPrefix}&sortBy=createdAt&sortOrder=desc`,
    );
    expect(createdDescRes.status).toBe(200);
    const timestamps = createdDescRes.body.data.items.map((p: { createdAt: string }) =>
      new Date(p.createdAt).getTime(),
    );
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
    }
  });

  describe('Validation rejection for query parameters', () => {
    it('rejects page < 1 with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/v1/problems?page=0');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects negative page with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/v1/problems?page=-5');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects non-numeric page with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/v1/problems?page=abc');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects limit < 1 with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/v1/problems?limit=0');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects limit > 50 with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/v1/problems?limit=51');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(res.body)).toContain('Limit cannot exceed 50');
    });

    it('rejects invalid difficulty enum with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/v1/problems?difficulty=EXTREME');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects arbitrary / unapproved sortBy fields with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/v1/problems?sortBy=statement');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid sortOrder with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/v1/problems?sortOrder=random');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });
});
