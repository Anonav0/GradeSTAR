# GradeSTAR — Database Integrity, Concurrency, and Lifecycle Architecture

## 1. Executive Summary

This document defines the audited data integrity guarantees, PostgreSQL database-level invariants, relational deletion policies, atomic concurrency models, and error classification strategy implemented in GradeSTAR (Phase 2B).

While Phase 2A established the initial Prisma models and schema migrations, Phase 2B hardens the database tier against race conditions, out-of-order execution states, invalid telemetry, and application-layer bypassing by embedding invariants directly into PostgreSQL via native `CHECK` constraints and partial unique indexes.

---

## 2. Audited Schema & Integrity Findings

The schema audit inspected all models, relationships, migration SQL, indexes, and execution semantics:

| Severity     | Domain / Area        | Finding                                                                                                                                                                  | Resolution                                                                                                                                                        |
| :----------- | :------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CRITICAL** | Submissions          | Evaluation verdict could be written while a submission was still `PENDING`, `QUEUED`, or `RUNNING`. A `COMPLETED` submission could also be stored with a `NULL` verdict. | Added PostgreSQL `CHECK` constraint `submissions_status_verdict_check` enforcing state/verdict invariant rules.                                                   |
| **HIGH**     | Execution Limits     | Problem execution limits (`timeLimitMs`, `memoryLimitMb`) and test case positions permitted zero or negative values at the DB level.                                     | Added `CHECK` constraints: `problems_timeLimitMs_positive_check`, `problems_memoryLimitMb_positive_check`, and `test_cases_position_positive_check`.              |
| **HIGH**     | Temporal Invariants  | Timestamps on `Submission` allowed impossible temporal sequences (e.g. `completedAt` before `startedAt`, or `startedAt` before `createdAt`).                             | Added `CHECK` constraints: `submissions_completedAt_after_startedAt_check` and `submissions_startedAt_after_createdAt_check`.                                     |
| **HIGH**     | Telemetry Invariants | `TestCaseResult` telemetry permitted negative metrics for execution duration and RAM consumed.                                                                           | Added `CHECK` constraints: `test_case_results_executionTimeMs_non_negative_check` and `test_case_results_memoryUsedKb_non_negative_check`.                        |
| **MEDIUM**   | Query Performance    | Frequent catalog filter query on published problems (`WHERE isPublished = true`) lacked an index, requiring full table scans on problem listings.                        | Added `@@index([isPublished])` on the `problems` table in Prisma schema and migration.                                                                            |
| **MEDIUM**   | Concurrency Races    | Stale background workers could overwrite newer terminal states (e.g., worker attempting to transition a `CANCELLED` job to `RUNNING`).                                   | Implemented atomic conditional update pattern (`atomicTransitionSubmissionStatus`) using `UPDATE submissions SET status = $to WHERE id = $id AND status = $from`. |

---

## 3. Database CHECK Constraints

PostgreSQL-level `CHECK` constraints were created via reviewed migration `20261113182853_add_integrity_check_constraints`:

### 3.1 Problem Constraints

- `problems_timeLimitMs_positive_check`:
  ```sql
  ALTER TABLE "problems" ADD CONSTRAINT "problems_timeLimitMs_positive_check"
    CHECK ("timeLimitMs" > 0);
  ```
- `problems_memoryLimitMb_positive_check`:
  ```sql
  ALTER TABLE "problems" ADD CONSTRAINT "problems_memoryLimitMb_positive_check"
    CHECK ("memoryLimitMb" > 0);
  ```

### 3.2 TestCase Constraints

- `test_cases_position_positive_check`:
  ```sql
  ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_position_positive_check"
    CHECK ("position" >= 1);
  ```

### 3.3 Submission Constraints

- `submissions_completedAt_after_startedAt_check`:
  ```sql
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_completedAt_after_startedAt_check"
    CHECK ("completedAt" IS NULL OR "startedAt" IS NULL OR "completedAt" >= "startedAt");
  ```
- `submissions_startedAt_after_createdAt_check`:
  ```sql
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_startedAt_after_createdAt_check"
    CHECK ("startedAt" IS NULL OR "startedAt" >= "createdAt");
  ```
- `submissions_status_verdict_check`:
  ```sql
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_status_verdict_check"
    CHECK (
      ("status" IN ('PENDING', 'QUEUED', 'RUNNING') AND "verdict" IS NULL) OR
      ("status" = 'COMPLETED' AND "verdict" IS NOT NULL) OR
      ("status" = 'FAILED' AND ("verdict" IS NULL OR "verdict" = 'SYSTEM_ERROR')) OR
      ("status" = 'CANCELLED' AND "verdict" IS NULL)
    );
  ```

### 3.4 TestCaseResult Constraints

- `test_case_results_executionTimeMs_non_negative_check`:
  ```sql
  ALTER TABLE "test_case_results" ADD CONSTRAINT "test_case_results_executionTimeMs_non_negative_check"
    CHECK ("executionTimeMs" IS NULL OR "executionTimeMs" >= 0);
  ```
- `test_case_results_memoryUsedKb_non_negative_check`:
  ```sql
  ALTER TABLE "test_case_results" ADD CONSTRAINT "test_case_results_memoryUsedKb_non_negative_check"
    CHECK ("memoryUsedKb" IS NULL OR "memoryUsedKb" >= 0);
  ```

---

## 4. Submission Lifecycle & Verdict Semantics

The GradeSTAR submission lifecycle is governed by an explicit finite state machine:

```
[ PENDING ] ───────► [ QUEUED ] ───────► [ RUNNING ] ───────► [ COMPLETED ]
     │                    │                   │
     ▼                    ▼                   ▼
[ CANCELLED ]        [ CANCELLED ]       [ CANCELLED ]
                                              │
                                              ▼
                                         [ FAILED ]
```

### 4.1 Permitted Transitions

- `PENDING` → `QUEUED` | `CANCELLED`
- `QUEUED` → `RUNNING` | `CANCELLED`
- `RUNNING` → `COMPLETED` | `FAILED` | `CANCELLED`
- Terminal States (`COMPLETED`, `FAILED`, `CANCELLED`): No outgoing transitions allowed.

### 4.2 Status vs. Verdict Separation

- **`status`**: Represents the operational pipeline state of the grading task (`PENDING`, `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`).
- **`verdict`**: Represents the evaluation result of the user's code (`ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `MEMORY_LIMIT_EXCEEDED`, `COMPILATION_ERROR`, `RUNTIME_ERROR`, `OUTPUT_LIMIT_EXCEEDED`, `SYSTEM_ERROR`).
- **Rule**: A failed user program (e.g. `WRONG_ANSWER` or `TIME_LIMIT_EXCEEDED`) is a **successful grading operation** (`status = COMPLETED`, `verdict = WRONG_ANSWER`). `status = FAILED` is reserved strictly for infrastructure/evaluator crashes, which may carry `verdict = SYSTEM_ERROR` or `verdict = NULL`.

---

## 5. Deletion & Retention Policies

| Relationship                     | PostgreSQL Foreign Key                                  | Prisma Action                     | Architectural Rationale                                                                                                                                                                                 |
| :------------------------------- | :------------------------------------------------------ | :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **User → Submissions**           | `FOREIGN KEY (userId) REFERENCES users(id)`             | `RESTRICT` (`onDelete: Restrict`) | Protects historical submission records and audit trail from accidental deletion when user accounts are removed. User decommissioning should anonymize or flag the user rather than purging submissions. |
| **Problem → TestCases**          | `FOREIGN KEY (problemId) REFERENCES problems(id)`       | `CASCADE` (`onDelete: Cascade`)   | Test cases belong exclusively to the parent problem. Deleting a draft problem cascades to remove its test case inputs/outputs.                                                                          |
| **Problem → Submissions**        | `FOREIGN KEY (problemId) REFERENCES problems(id)`       | `RESTRICT` (`onDelete: Restrict`) | Prevents accidental deletion of problems that have historical student submissions. To unpublish a problem, administrators set `isPublished = false`.                                                    |
| **Language → Submissions**       | `FOREIGN KEY (languageId) REFERENCES languages(id)`     | `RESTRICT` (`onDelete: Restrict`) | Disabling a compiler/runtime should not purge existing submission records. Languages are retired via `isEnabled = false`.                                                                               |
| **Submission → TestCaseResults** | `FOREIGN KEY (submissionId) REFERENCES submissions(id)` | `CASCADE` (`onDelete: Cascade`)   | Individual execution outputs are owned strictly by the parent submission. Purging a test submission deletes its execution telemetry.                                                                    |
| **TestCase → TestCaseResults**   | `FOREIGN KEY (testCaseId) REFERENCES test_cases(id)`    | `RESTRICT` (`onDelete: Restrict`) | Historical submissions reference the exact test cases evaluated against. Prevents deleting test cases that back existing submission records.                                                            |

---

## 6. Concurrency Guarantees & Transaction Boundaries

### 6.1 Database-Level Uniqueness vs. Application Pre-Checks

Application queries of the form:

```ts
const existing = await prisma.user.findUnique({ where: { email } });
if (!existing) {
  await prisma.user.create({ data: { email, ... } });
}
```

are vulnerable to Time-of-Check to Time-of-Use (TOCTOU) race conditions under concurrent requests. GradeSTAR relies strictly on PostgreSQL unique constraints (`users.email`, `problems.slug`, `languages.slug`, `submissions.queueJobId`, `test_cases(problemId, position)`, and `test_case_results(submissionId, testCaseId)`).

### 6.2 Atomic Worker Claims (Conditional Updates)

To prevent worker duplicate processing and race conditions without heavy table locking:

```sql
UPDATE "submissions"
SET "status" = 'RUNNING', "startedAt" = $startedAt
WHERE "id" = $submissionId AND "status" = 'QUEUED';
```

In Prisma, this is implemented as:

```ts
const result = await client.submission.updateMany({
  where: { id: submissionId, status: SubmissionStatus.QUEUED },
  data: { status: SubmissionStatus.RUNNING, startedAt: new Date() },
});
if (result.count === 0) {
  // Stale claim attempt or already cancelled by user
}
```

### 6.3 Multi-Operation Transaction Rollback

All multi-step state mutations (such as recording results and transitioning submission status) are wrapped in `withTransaction(prisma, async (tx) => { ... })`. Any unhandled failure triggers an immediate PostgreSQL `ROLLBACK`, guaranteeing zero partial records.

---

## 7. Prisma Error Classification

The database package provides typed helpers in `packages/database/src/errors.ts`:

- `isUniqueConstraintViolation(err)`: Detects Prisma code `P2002`.
- `isForeignKeyViolation(err)`: Detects Prisma code `P2003`.
- `isRecordNotFound(err)`: Detects Prisma code `P2025`.
- `isCheckConstraintViolation(err)`: Detects PostgreSQL code `23514` (`P2004`, `P2010`, or `PrismaClientUnknownRequestError`).
- `isTransactionConflict(err)`: Detects code `P2034` (deadlocks/serialization conflicts).
- `classifyDatabaseError(err)`: Returns a structured domain error object `{ category, code, message, target }`.

---

## 8. Migration Safety & Remediation Procedures

1. **New Migrations Only**: Historical migrations are immutable. All new constraints are applied via dedicated migration files (`prisma migrate dev`).
2. **Pre-Constraint Data Auditing**:
   Before applying check constraints, existing records must be audited:
   ```sql
   SELECT count(*) FROM problems WHERE "timeLimitMs" <= 0;
   SELECT count(*) FROM submissions WHERE "completedAt" < "startedAt";
   ```
   If violating records exist, safe remediation (updating with sane defaults or quarantining) must precede constraint addition.
3. **Rollback Strategy**:
   If a migration needs reversion in staging:
   ```sql
   ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_status_verdict_check";
   ```

---

## 9. Known Limitations

- **Email Case Sensitivity**: The unique index on `users.email` is currently exact-match in PostgreSQL. Consistent lowercase email normalization must be enforced at the application boundary prior to insertion.
- **Test Case Immutability / Versioning**: In the current schema, test cases are mutable by problem authors. Versioning of test cases across problem revisions will be addressed in future phases.
