# GradeSTAR — Database Setup & Operations Guide

## 1. Overview & Prerequisites

GradeSTAR uses **PostgreSQL 16** with **Prisma ORM** for persistent relational storage.

Prerequisites:

- **Node.js**: v20 LTS (`node -v`)
- **npm**: v10+ (`npm -v`)
- **Docker & Docker Compose**: Docker 24+ and Docker Compose v2+
- **PostgreSQL Client (Optional)**: `psql` for manual CLI administration

---

## 2. Environment Configuration

Copy `.env.example` to `.env` in the root workspace:

```bash
cp .env.example .env
```

Ensure a symlink exists inside `packages/database`:

```bash
ln -sf ../../.env packages/database/.env
```

Key environment variables:

| Variable            | Default Value                                                                        | Description                                                               |
| :------------------ | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| `DATABASE_URL`      | `postgresql://gradestar:gradestar_dev_secret@localhost:5433/gradestar?schema=public` | PostgreSQL connection string targeting port `5433` (Docker host mapping). |
| `POSTGRES_USER`     | `gradestar`                                                                          | PostgreSQL superuser for development.                                     |
| `POSTGRES_PASSWORD` | `gradestar_dev_secret`                                                               | Password for development user.                                            |
| `POSTGRES_DB`       | `gradestar`                                                                          | Default application database name.                                        |
| `POSTGRES_PORT`     | `5433`                                                                               | Host port mapped to PostgreSQL container port `5432`.                     |

> [!NOTE]
> Port `5433` is deliberately used on the host to prevent port collisions with any local PostgreSQL instance installed on the development workstation.

---

## 3. Starting Local Database Infrastructure

Launch the PostgreSQL and Redis containers in daemon mode:

```bash
npm run infra:up
```

Verify that containers are healthy:

```bash
docker compose ps
```

Expected output:

```
NAME                 IMAGE                STATUS
gradestar-postgres   postgres:16-alpine   Up (healthy)   0.0.0.0:5433->5432/tcp
gradestar-redis      redis:7-alpine       Up (healthy)   0.0.0.0:6379->6379/tcp
```

---

## 4. Applying Migrations & Generating Prisma Client

Generate the Prisma Client code:

```bash
npm run db:generate
```

Apply all committed migrations to PostgreSQL:

```bash
npm run db:deploy
```

Check migration application status:

```bash
npm run db:status
```

Expected output:

```
2 migrations found in prisma/migrations
Database schema is up to date!
```

---

## 5. Hardened Database Seeding

GradeSTAR provides an idempotent, transactional database seed script:

```bash
npm run db:seed
```

Expected output:

```
Starting GradeSTAR database seeding...
Seeding completed successfully: 3 languages, 3 problems, 12 test cases.
```

### Seeding Guarantees:

- **Transaction-Wrapped**: All seed operations execute inside an atomic Prisma transaction (`$transaction`). If any step fails, changes roll back immediately.
- **Idempotent**: Re-running `npm run db:seed` executes cleanly and creates 0 duplicate records.
- **Non-Destructive**: Re-seeding preserves unrelated user accounts, user-authored problems, student submissions, and execution telemetry.

---

## 6. Running Clean-Database Migration Reproducibility Check

To prove that a completely fresh, empty PostgreSQL database can be initialized from scratch using committed migrations:

```bash
npm run db:verify-clean
```

The script executes the following automated pipeline:

1. Creates an isolated disposable database: `gradestar_clean_verify`.
2. Applies all committed migrations using `prisma migrate deploy`.
3. Verifies tables, enums, indexes, and all 8 PostgreSQL `CHECK` constraints in the catalog.
4. Executes the initial seed and verifies 3 languages, 3 problems, and 12 test cases.
5. Tests representative relational queries (`getPublishedProblemBySlug`, `getPublicTestCases`, `getEvaluationTestCases`, `getEnabledLanguages`).
6. Executes the seed a second time to verify idempotency on a clean DB.
7. Drops the disposable database cleanly upon completion.

---

## 7. Running Database Integration Tests

Execute the full database test suite:

```bash
npm run test --workspace=@gradestar/database
```

The suite covers 7 test files:

- `seed-hardening.test.ts`: Seed correctness, idempotency, user data preservation, failure handling.
- `queries.test.ts`: Relational queries, hidden test case exclusion, submission joins.
- `integrity.test.ts`: PostgreSQL `CHECK` constraints (positive limits, temporal sequence, status/verdict matrix).
- `concurrency.test.ts`: Race condition safety, duplicate insertion conflicts, atomic worker claims, transaction rollback.
- `database.test.ts`: Core relational models and CRUD operations.
- `schema.test.ts`: Prisma schema structure and configuration.
- `seed.test.ts`: Baseline seed tests.

---

## 8. Safe Recovery & Troubleshooting

### Problem: `Connection refused` on port 5433

- Verify that Docker Desktop / Docker daemon is running.
- Run `npm run infra:up` to restart the database container.
- Confirm container health: `docker compose ps`.

### Problem: Missing `DATABASE_URL` during seeding

- Ensure `.env` is present in root and symlinked into `packages/database/.env`.
- Run: `ln -sf ../../.env packages/database/.env`.

### Problem: Migration Drift or Dirty Database in Development

If a development database enters an inconsistent state during local experimentation:

1. Verify what migrations are pending: `npm run db:status`.
2. If working on a disposable development database and a clean reset is desired:
   ```bash
   npm run prisma:migrate --workspace=@gradestar/database -- --reset
   ```
   > [!CAUTION]
   > `--reset` drops all tables and data. Never execute against staging or production databases.
