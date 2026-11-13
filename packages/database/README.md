# @gradestar/database

This package is the data persistence layer for GradeSTAR, managing PostgreSQL access via Prisma ORM.

## Features (Phase 2A Implemented)

- **Schema & Migrations**: Defined models (`User`, `Problem`, `Language`, `TestCase`, `Submission`, `TestCaseResult`) and version-controlled Prisma migrations.
- **Enums**: Distinct lifecycle `SubmissionStatus` (`PENDING`, `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`) and canonical `Verdict` (`ACCEPTED`, `WRONG_ANSWER`, `COMPILATION_ERROR`, `RUNTIME_ERROR`, `TIME_LIMIT_EXCEEDED`, `MEMORY_LIMIT_EXCEEDED`, `OUTPUT_LIMIT_EXCEEDED`, `SYSTEM_ERROR`).
- **Database Client Singleton**: Reusable `prisma` instance across Node services with connection recycling and hot-reload protection.
- **Health Checks**: `checkDatabaseHealth()` for live PostgreSQL pinging.
- **Idempotent Seeding**: `seedDatabase()` to provision default languages (C++17, Python 3, Java 21) and sample algorithmic problems with public and hidden test cases.

## Available Scripts

```bash
# Generate Prisma Client
npm run prisma:generate

# Apply pending migrations locally
npm run prisma:migrate

# Deploy migrations in production / CI
npm run prisma:deploy

# Inspect migration status
npm run prisma:status

# Seed sample problems & languages
npm run seed

# Run database test suite
npm run test
```
