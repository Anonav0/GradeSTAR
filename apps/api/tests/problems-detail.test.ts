import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, ProblemDifficulty, TestCaseVisibility, type DbClient } from '@gradestar/database';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';

describe('Problem Detail API (/api/v1/problems/:slug)', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });
  const app = createApp({ logger });

  const testPrefix = `pdetail-${Date.now()}`;
  const publishedSlug = `${testPrefix}-published`;
  const unpublishedSlug = `${testPrefix}-unpublished`;

  const secretHiddenInput1 = `SECRET_INPUT_1_${testPrefix}`;
  const secretHiddenOutput1 = `SECRET_OUTPUT_1_${testPrefix}`;
  const secretHiddenInput2 = `SECRET_INPUT_2_${testPrefix}`;
  const secretHiddenOutput2 = `SECRET_OUTPUT_2_${testPrefix}`;

  let publishedProblemId: string;
  let unpublishedProblemId: string;
  let hiddenTestCaseId1: string;

  beforeAll(async () => {
    // 1. Create a published problem with BOTH public and hidden test cases
    const pub = await prisma.problem.create({
      data: {
        slug: publishedSlug,
        title: 'Detailed Problem With Mixed Test Cases',
        statement: 'Solve this interesting algorithmic challenge.',
        difficulty: ProblemDifficulty.MEDIUM,
        inputDescription: 'An array of numbers',
        outputDescription: 'A single integer',
        constraints: '1 <= N <= 10^5',
        timeLimitMs: 1500,
        memoryLimitMb: 256,
        isPublished: true,
        testCases: {
          create: [
            {
              position: 1,
              visibility: TestCaseVisibility.PUBLIC,
              input: 'public input 1',
              expectedOutput: 'public output 1',
            },
            {
              position: 2,
              visibility: TestCaseVisibility.PUBLIC,
              input: 'public input 2',
              expectedOutput: 'public output 2',
            },
            {
              position: 3,
              visibility: TestCaseVisibility.HIDDEN,
              input: secretHiddenInput1,
              expectedOutput: secretHiddenOutput1,
            },
            {
              position: 4,
              visibility: TestCaseVisibility.HIDDEN,
              input: secretHiddenInput2,
              expectedOutput: secretHiddenOutput2,
            },
          ],
        },
      },
      include: {
        testCases: true,
      },
    });
    publishedProblemId = pub.id;
    const hiddenTc = pub.testCases.find((tc) => tc.visibility === TestCaseVisibility.HIDDEN);
    hiddenTestCaseId1 = hiddenTc!.id;

    // 2. Create an UNPUBLISHED problem
    const unpub = await prisma.problem.create({
      data: {
        slug: unpublishedSlug,
        title: 'Draft Problem Not Ready For Public',
        statement: 'Top secret draft statement.',
        difficulty: ProblemDifficulty.HARD,
        inputDescription: 'Draft input',
        outputDescription: 'Draft output',
        timeLimitMs: 2000,
        memoryLimitMb: 512,
        isPublished: false,
      },
    });
    unpublishedProblemId = unpub.id;
  });

  afterAll(async () => {
    await prisma.problem.deleteMany({
      where: {
        id: { in: [publishedProblemId, unpublishedProblemId] },
      },
    });
  });

  it('allows anonymous caller to retrieve published problem details', async () => {
    const res = await request(app).get(`/api/v1/problems/${publishedSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const problem = res.body.data.problem;
    expect(problem.slug).toBe(publishedSlug);
    expect(problem.title).toBe('Detailed Problem With Mixed Test Cases');
    expect(problem.statement).toBe('Solve this interesting algorithmic challenge.');
    expect(problem.difficulty).toBe(ProblemDifficulty.MEDIUM);
    expect(problem.inputDescription).toBe('An array of numbers');
    expect(problem.outputDescription).toBe('A single integer');
    expect(problem.constraints).toBe('1 <= N <= 10^5');
    expect(problem.timeLimitMs).toBe(1500);
    expect(problem.memoryLimitMb).toBe(256);
  });

  it('includes public sample test cases ordered by position ascending', async () => {
    const res = await request(app).get(`/api/v1/problems/${publishedSlug}`);
    expect(res.status).toBe(200);

    const samples = res.body.data.problem.sampleTestCases;
    expect(Array.isArray(samples)).toBe(true);
    expect(samples.length).toBe(2);

    expect(samples[0]).toEqual({
      position: 1,
      input: 'public input 1',
      expectedOutput: 'public output 1',
    });

    expect(samples[1]).toEqual({
      position: 2,
      input: 'public input 2',
      expectedOutput: 'public output 2',
    });
  });

  it('strictly excludes hidden test cases from problem detail response', async () => {
    const res = await request(app).get(`/api/v1/problems/${publishedSlug}`);
    expect(res.status).toBe(200);

    const samples = res.body.data.problem.sampleTestCases;
    // Samples must contain only public items
    for (const sample of samples) {
      expect(sample.input).not.toBe(secretHiddenInput1);
      expect(sample.input).not.toBe(secretHiddenInput2);
      expect(sample.expectedOutput).not.toBe(secretHiddenOutput1);
      expect(sample.expectedOutput).not.toBe(secretHiddenOutput2);
    }
  });

  it('regression: full HTTP serialized response never leaks hidden test inputs, outputs, or IDs', async () => {
    const res = await request(app).get(`/api/v1/problems/${publishedSlug}`);
    expect(res.status).toBe(200);

    const fullResponseText = res.text;

    // 1. Hidden inputs and outputs must never exist anywhere in the payload
    expect(fullResponseText).not.toContain(secretHiddenInput1);
    expect(fullResponseText).not.toContain(secretHiddenOutput1);
    expect(fullResponseText).not.toContain(secretHiddenInput2);
    expect(fullResponseText).not.toContain(secretHiddenOutput2);

    // 2. Hidden test case IDs must never exist
    expect(fullResponseText).not.toContain(hiddenTestCaseId1);

    // 3. No visibility metadata or internal fields on samples
    expect(res.body.data.problem.sampleTestCases[0]).not.toHaveProperty('id');
    expect(res.body.data.problem.sampleTestCases[0]).not.toHaveProperty('visibility');
    expect(res.body.data.problem.sampleTestCases[0]).not.toHaveProperty('problemId');
    expect(res.body.data.problem.sampleTestCases[0]).not.toHaveProperty('createdAt');
    expect(res.body.data.problem.sampleTestCases[0]).not.toHaveProperty('updatedAt');

    // 4. No internal database fields on problem object
    expect(res.body.data.problem).not.toHaveProperty('id');
    expect(res.body.data.problem).not.toHaveProperty('isPublished');
    expect(res.body.data.problem).not.toHaveProperty('createdAt');
    expect(res.body.data.problem).not.toHaveProperty('updatedAt');
  });

  it('returns 404 for nonexistent problem slug', async () => {
    const res = await request(app).get('/api/v1/problems/non-existent-problem-slug-123');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('PROBLEM_NOT_FOUND');
    expect(res.body.message).toBe('Problem not found');
  });

  it('returns the exact same 404 response for unpublished problem as for nonexistent problem', async () => {
    const nonExistentRes = await request(app).get('/api/v1/problems/completely-fake-problem-xyz');
    const unpublishedRes = await request(app).get(`/api/v1/problems/${unpublishedSlug}`);

    // Both must be 404
    expect(nonExistentRes.status).toBe(404);
    expect(unpublishedRes.status).toBe(404);

    // Both must return identical error code and message
    expect(unpublishedRes.body.error).toBe(nonExistentRes.body.error);
    expect(unpublishedRes.body.message).toBe(nonExistentRes.body.message);

    // Neither discloses whether the slug exists in the database
    expect(unpublishedRes.text).not.toContain('unpublished');
    expect(unpublishedRes.text).not.toContain('draft');
  });

  it('rejects invalid slug format with 400 VALIDATION_ERROR', async () => {
    // Uppercase characters
    const resUpper = await request(app).get('/api/v1/problems/TWO-SUM');
    expect(resUpper.status).toBe(400);
    expect(resUpper.body.error).toBe('VALIDATION_ERROR');

    // Invalid punctuation / symbols
    const resInvalid = await request(app).get('/api/v1/problems/two_sum!special');
    expect(resInvalid.status).toBe(400);
    expect(resInvalid.body.error).toBe('VALIDATION_ERROR');
  });

  it('handles database error gracefully via centralized error handler', async () => {
    const brokenDb = {
      problem: {
        findFirst: async () => {
          throw new Error('Database connection failed unexpectedly');
        },
      },
    } as unknown as DbClient;

    const brokenApp = createApp({ logger, db: brokenDb });
    const res = await request(brokenApp).get(`/api/v1/problems/${publishedSlug}`);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('statusCode', 500);
    expect(res.body).toHaveProperty('timestamp');
  });
});
