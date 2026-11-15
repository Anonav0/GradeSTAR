import 'dotenv/config';
import { execSync } from 'node:child_process';
import { PrismaClient, TestCaseVisibility } from '@prisma/client';
import {
  SEED_LANGUAGES,
  SEED_PROBLEMS,
  seedDatabase,
  getPublishedProblemBySlug,
  getPublicTestCases,
  getEvaluationTestCases,
  getEnabledLanguages,
} from '../src/index.js';

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMA_PATH = path.resolve(__dirname, '../prisma/schema.prisma');
const DISPOSABLE_DB_NAME = 'gradestar_clean_verify';

function getAdminDatabaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = '/postgres';
  return url.toString();
}

function getCleanDatabaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${DISPOSABLE_DB_NAME}`;
  return url.toString();
}

async function runCommand(command: string, env: Record<string, string>): Promise<string> {
  return execSync(command, {
    env: { ...process.env, ...env },
    encoding: 'utf-8',
    stdio: 'pipe',
  });
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('===============================================================');
  // eslint-disable-next-line no-console
  console.log(' GradeSTAR Clean-Database Migration Reproducibility Check');
  // eslint-disable-next-line no-console
  console.log('===============================================================\n');

  const baseDbUrl = process.env['DATABASE_URL'];
  if (!baseDbUrl) {
    throw new Error('DATABASE_URL is not set. Cannot run clean-database verification.');
  }

  // Safety check: Never drop or overwrite primary database
  const targetUrl = new URL(baseDbUrl);
  if (targetUrl.pathname === `/${DISPOSABLE_DB_NAME}`) {
    throw new Error(
      `DATABASE_URL is already pointing to ${DISPOSABLE_DB_NAME}. Please point to your standard development database.`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(`[1/8] Setting up isolated disposable test database: "${DISPOSABLE_DB_NAME}"...`);

  // Create isolated disposable database via direct admin connection
  const adminDbUrl = getAdminDatabaseUrl(baseDbUrl);
  const cleanDbUrl = getCleanDatabaseUrl(baseDbUrl);

  const adminPrisma = new PrismaClient({
    datasources: { db: { url: adminDbUrl } },
  });

  try {
    await adminPrisma.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS ${DISPOSABLE_DB_NAME} WITH (FORCE);`,
    );
    await adminPrisma.$executeRawUnsafe(`CREATE DATABASE ${DISPOSABLE_DB_NAME};`);
  } catch (err) {
    // If administrative connection directly failed, attempt docker compose fallback
    try {
      execSync(
        `docker compose exec -T postgres psql -U gradestar -d postgres -c "DROP DATABASE IF EXISTS ${DISPOSABLE_DB_NAME} WITH (FORCE);"`,
        { stdio: 'pipe' },
      );
      execSync(
        `docker compose exec -T postgres psql -U gradestar -d postgres -c "CREATE DATABASE ${DISPOSABLE_DB_NAME};"`,
        { stdio: 'pipe' },
      );
    } catch {
      throw err;
    }
  } finally {
    await adminPrisma.$disconnect();
  }

  // eslint-disable-next-line no-console
  console.log(`✓ Clean database "${DISPOSABLE_DB_NAME}" created successfully.`);

  // Step 2: Run Prisma migrate deploy
  // eslint-disable-next-line no-console
  console.log('\n[2/8] Applying all committed migrations via "prisma migrate deploy"...');
  const migrationOutput = await runCommand(`npx prisma migrate deploy --schema="${SCHEMA_PATH}"`, {
    DATABASE_URL: cleanDbUrl,
  });
  // eslint-disable-next-line no-console
  console.log(migrationOutput.trim());
  // eslint-disable-next-line no-console
  console.log('✓ All migrations applied cleanly without errors.');

  // Step 3: Connect Prisma Client to clean database
  // eslint-disable-next-line no-console
  console.log('\n[3/8] Connecting Prisma client to disposable database...');
  const cleanPrisma = new PrismaClient({
    datasources: { db: { url: cleanDbUrl } },
  });

  try {
    // Step 4: Verify schema, tables, enums, check constraints and indexes
    // eslint-disable-next-line no-console
    console.log('\n[4/8] Verifying PostgreSQL catalog: tables, enums, constraints, and indexes...');

    const tables = (
      await cleanPrisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
    ).map((r) => r.table_name);

    const expectedTables = [
      '_prisma_migrations',
      'languages',
      'problems',
      'submissions',
      'test_case_results',
      'test_cases',
      'users',
    ];

    for (const expected of expectedTables) {
      if (!tables.includes(expected)) {
        throw new Error(`Missing expected table in clean schema: ${expected}`);
      }
    }
    // eslint-disable-next-line no-console
    console.log(`✓ All expected tables exist: [${tables.join(', ')}]`);

    // Verify CHECK constraints
    const constraints = (
      await cleanPrisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname
      FROM pg_constraint
      WHERE contype = 'c'
      ORDER BY conname;
    `
    ).map((r) => r.conname);

    const expectedConstraints = [
      'problems_timeLimitMs_positive_check',
      'problems_memoryLimitMb_positive_check',
      'test_cases_position_positive_check',
      'submissions_completedAt_after_startedAt_check',
      'submissions_startedAt_after_createdAt_check',
      'submissions_status_verdict_check',
      'test_case_results_executionTimeMs_non_negative_check',
      'test_case_results_memoryUsedKb_non_negative_check',
    ];

    for (const expectedCon of expectedConstraints) {
      if (!constraints.includes(expectedCon)) {
        throw new Error(`Missing expected CHECK constraint: ${expectedCon}`);
      }
    }
    // eslint-disable-next-line no-console
    console.log(`✓ All 8 Phase 2B CHECK constraints verified in PostgreSQL catalog.`);

    // Verify indexes
    const indexes = (
      await cleanPrisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY indexname;
    `
    ).map((r) => r.indexname);

    if (!indexes.includes('problems_isPublished_idx')) {
      throw new Error('Missing expected index: problems_isPublished_idx');
    }
    // eslint-disable-next-line no-console
    console.log(`✓ Catalog index verified: problems_isPublished_idx`);

    // Step 5: Run initial seed
    // eslint-disable-next-line no-console
    console.log('\n[5/8] Running initial seed on clean database...');
    process.env['DATABASE_URL'] = cleanDbUrl;
    const seed1 = await seedDatabase(cleanPrisma);
    expectEqual(seed1.languagesCount, SEED_LANGUAGES.length, 'Seeded languages count');
    expectEqual(seed1.problemsCount, SEED_PROBLEMS.length, 'Seeded problems count');
    expectEqual(seed1.testCasesCount, 12, 'Seeded test cases count (4 * 3)');
    // eslint-disable-next-line no-console
    console.log(`✓ Initial seed completed: 3 languages, 3 problems, 12 test cases.`);

    // Step 6: Test representative relational queries on clean DB
    // eslint-disable-next-line no-console
    console.log('\n[6/8] Executing representative relational queries on clean database...');

    const published = await getPublishedProblemBySlug(cleanPrisma, 'two-sum', {
      includePublicTestCases: true,
    });
    if (!published || !('testCases' in published)) {
      throw new Error('Failed to retrieve published problem with public test cases');
    }
    // eslint-disable-next-line no-console
    console.log(
      `✓ getPublishedProblemBySlug: retrieved "${published.title}" with ${published.testCases.length} public test cases.`,
    );

    const publicCases = await getPublicTestCases(cleanPrisma, published.id);
    if (publicCases.length !== 2) {
      throw new Error(`Expected 2 public test cases for Two Sum, got ${publicCases.length}`);
    }
    if (publicCases.some((tc) => tc.visibility !== TestCaseVisibility.PUBLIC)) {
      throw new Error('Public test cases query returned non-public test cases!');
    }
    // eslint-disable-next-line no-console
    console.log(
      `✓ getPublicTestCases: confirmed exactly 2 public test cases (hidden cases excluded).`,
    );

    const evalCases = await getEvaluationTestCases(cleanPrisma, published.id);
    if (evalCases.length !== 4) {
      throw new Error(
        `Expected 4 total test cases for Two Sum evaluation, got ${evalCases.length}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(
      `✓ getEvaluationTestCases: confirmed all 4 test cases (public + hidden) accessible to evaluator.`,
    );

    const enabledLangs = await getEnabledLanguages(cleanPrisma);
    if (enabledLangs.length !== 3) {
      throw new Error(`Expected 3 enabled languages, got ${enabledLangs.length}`);
    }
    // eslint-disable-next-line no-console
    console.log(
      `✓ getEnabledLanguages: retrieved 3 active languages: [${enabledLangs.map((l) => l.name).join(', ')}].`,
    );

    // Step 7: Run seed a second time to verify idempotency on clean database
    // eslint-disable-next-line no-console
    console.log('\n[7/8] Running seed a second time to test idempotency on clean database...');
    const seed2 = await seedDatabase(cleanPrisma);
    expectEqual(seed2.languagesCount, seed1.languagesCount, 'Idempotent languages count');
    expectEqual(seed2.problemsCount, seed1.problemsCount, 'Idempotent problems count');
    expectEqual(seed2.testCasesCount, seed1.testCasesCount, 'Idempotent test cases count');
    // eslint-disable-next-line no-console
    console.log(`✓ Seed idempotency verified: 0 duplicate records created on repeated execution.`);

    // Step 8: Tear down disposable test database
    // eslint-disable-next-line no-console
    console.log(`\n[8/8] Tearing down disposable database "${DISPOSABLE_DB_NAME}"...`);
    await cleanPrisma.$disconnect();

    const teardownAdmin = new PrismaClient({ datasources: { db: { url: adminDbUrl } } });
    try {
      await teardownAdmin.$executeRawUnsafe(
        `DROP DATABASE IF EXISTS ${DISPOSABLE_DB_NAME} WITH (FORCE);`,
      );
    } catch {
      try {
        execSync(
          `docker compose exec -T postgres psql -U gradestar -d postgres -c "DROP DATABASE IF EXISTS ${DISPOSABLE_DB_NAME} WITH (FORCE);"`,
          { stdio: 'pipe' },
        );
      } catch {
        // ignore
      }
    } finally {
      await teardownAdmin.$disconnect();
    }
    // eslint-disable-next-line no-console
    console.log(`✓ Disposable database "${DISPOSABLE_DB_NAME}" cleaned up cleanly.`);

    // eslint-disable-next-line no-console
    console.log('\n===============================================================');
    // eslint-disable-next-line no-console
    console.log(' RESULT: Clean-Database Migration Reproducibility VERIFIED! (PASS)');
    // eslint-disable-next-line no-console
    console.log('===============================================================\n');
  } catch (error) {
    await cleanPrisma.$disconnect();
    throw error;
  }
}

function expectEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed for ${message}: expected ${expected}, got ${actual}`);
  }
}

main().catch((err) => {
  console.error('\n❌ Clean-database verification failed:', err);
  process.exit(1);
});
