import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Prisma Schema and Migration Artifacts', () => {
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
  const migrationsDir = path.resolve(__dirname, '../prisma/migrations');

  it('contains the expected schema models and enums', () => {
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Verify Enums
    expect(schemaContent).toContain('enum UserRole');
    expect(schemaContent).toContain('enum ProblemDifficulty');
    expect(schemaContent).toContain('enum TestCaseVisibility');
    expect(schemaContent).toContain('enum SubmissionStatus');
    expect(schemaContent).toContain('enum Verdict');

    // Verify Models
    expect(schemaContent).toContain('model User');
    expect(schemaContent).toContain('model Problem');
    expect(schemaContent).toContain('model Language');
    expect(schemaContent).toContain('model TestCase');
    expect(schemaContent).toContain('model Submission');
    expect(schemaContent).toContain('model TestCaseResult');
  });

  it('contains version-controlled migration files with expected DDL', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    const migrationFolders = fs
      .readdirSync(migrationsDir)
      .filter((dir) => dir.includes('init_domain_schema'));

    expect(migrationFolders.length).toBeGreaterThan(0);
    const migrationSqlPath = path.join(migrationsDir, migrationFolders[0]!, 'migration.sql');
    const sqlContent = fs.readFileSync(migrationSqlPath, 'utf-8');

    // Verify SQL Table Creations
    expect(sqlContent).toContain('CREATE TABLE "users"');
    expect(sqlContent).toContain('CREATE TABLE "problems"');
    expect(sqlContent).toContain('CREATE TABLE "languages"');
    expect(sqlContent).toContain('CREATE TABLE "test_cases"');
    expect(sqlContent).toContain('CREATE TABLE "submissions"');
    expect(sqlContent).toContain('CREATE TABLE "test_case_results"');

    // Verify Key Constraints and Foreign Keys
    expect(sqlContent).toContain('users_email_key');
    expect(sqlContent).toContain('problems_slug_key');
    expect(sqlContent).toContain('languages_slug_key');
    expect(sqlContent).toContain('test_cases_problemId_position_key');
    expect(sqlContent).toContain('test_case_results_submissionId_testCaseId_key');
    expect(sqlContent).toContain('ON DELETE CASCADE');
    expect(sqlContent).toContain('ON DELETE RESTRICT');
  });
});
