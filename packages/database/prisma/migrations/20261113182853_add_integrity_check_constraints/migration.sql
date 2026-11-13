-- CreateIndex
CREATE INDEX "problems_isPublished_idx" ON "problems"("isPublished");

-- ==============================================================================
-- Phase 2B: Database-Level Integrity Constraints (CHECK Constraints)
-- ==============================================================================

-- 1. Problems: Execution Limits Invariants
ALTER TABLE "problems"
  ADD CONSTRAINT "problems_timeLimitMs_positive_check"
  CHECK ("timeLimitMs" > 0);

ALTER TABLE "problems"
  ADD CONSTRAINT "problems_memoryLimitMb_positive_check"
  CHECK ("memoryLimitMb" > 0);

-- 2. Test Cases: Execution Position Invariant
ALTER TABLE "test_cases"
  ADD CONSTRAINT "test_cases_position_positive_check"
  CHECK ("position" >= 1);

-- 3. Submissions: Temporal & Lifecycle Invariants
ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_completedAt_after_startedAt_check"
  CHECK ("completedAt" IS NULL OR "startedAt" IS NULL OR "completedAt" >= "startedAt");

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_startedAt_after_createdAt_check"
  CHECK ("startedAt" IS NULL OR "startedAt" >= "createdAt");

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_status_verdict_check"
  CHECK (
    ("status" IN ('PENDING', 'QUEUED', 'RUNNING') AND "verdict" IS NULL) OR
    ("status" = 'COMPLETED' AND "verdict" IS NOT NULL) OR
    ("status" = 'FAILED' AND ("verdict" IS NULL OR "verdict" = 'SYSTEM_ERROR')) OR
    ("status" = 'CANCELLED' AND "verdict" IS NULL)
  );

-- 4. Test Case Results: Non-negative Execution Telemetry Metrics
ALTER TABLE "test_case_results"
  ADD CONSTRAINT "test_case_results_executionTimeMs_non_negative_check"
  CHECK ("executionTimeMs" IS NULL OR "executionTimeMs" >= 0);

ALTER TABLE "test_case_results"
  ADD CONSTRAINT "test_case_results_memoryUsedKb_non_negative_check"
  CHECK ("memoryUsedKb" IS NULL OR "memoryUsedKb" >= 0);
