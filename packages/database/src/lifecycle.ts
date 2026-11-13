import { Prisma, PrismaClient, SubmissionStatus, Verdict } from '@prisma/client';

/**
 * Valid submission status transitions according to the GradeSTAR lifecycle model.
 * Terminal states (COMPLETED, FAILED, CANCELLED) have no valid outgoing transitions.
 */
export const VALID_STATUS_TRANSITIONS: Record<SubmissionStatus, readonly SubmissionStatus[]> = {
  PENDING: ['QUEUED', 'CANCELLED'],
  QUEUED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

/**
 * Validates whether a state transition is permitted by the submission lifecycle state machine.
 */
export function isValidStatusTransition(from: SubmissionStatus, to: SubmissionStatus): boolean {
  const allowed = VALID_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export interface TransitionSubmissionParams {
  submissionId: string;
  fromStatus: SubmissionStatus;
  toStatus: SubmissionStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  verdict?: Verdict | null;
  queueJobId?: string | null;
}

export type TransitionResult =
  | { success: true; updatedCount: 1 }
  | {
      success: false;
      updatedCount: 0;
      reason: 'INVALID_TRANSITION' | 'STALE_STATE_OR_NOT_FOUND';
    };

/**
 * Atomically transitions a submission from one status to another.
 * Prevents race conditions and stale worker updates using an atomic conditional update:
 * `UPDATE submissions SET status = $to WHERE id = $id AND status = $from`
 *
 * If the submission status has already changed (e.g. cancelled by user or claimed by another worker),
 * the update atomically updates 0 rows and returns `{ success: false, reason: 'STALE_STATE_OR_NOT_FOUND' }`.
 */
export async function atomicTransitionSubmissionStatus(
  client: PrismaClient | Prisma.TransactionClient,
  params: TransitionSubmissionParams,
): Promise<TransitionResult> {
  const { submissionId, fromStatus, toStatus, startedAt, completedAt, verdict, queueJobId } =
    params;

  if (!isValidStatusTransition(fromStatus, toStatus)) {
    return {
      success: false,
      updatedCount: 0,
      reason: 'INVALID_TRANSITION',
    };
  }

  const updateData: Prisma.SubmissionUpdateInput = {
    status: toStatus,
  };

  if (startedAt !== undefined) {
    updateData.startedAt = startedAt;
  }
  if (completedAt !== undefined) {
    updateData.completedAt = completedAt;
  }
  if (verdict !== undefined) {
    updateData.verdict = verdict;
  }
  if (queueJobId !== undefined) {
    updateData.queueJobId = queueJobId;
  }

  const result = await client.submission.updateMany({
    where: {
      id: submissionId,
      status: fromStatus,
    },
    data: updateData,
  });

  if (result.count === 0) {
    return {
      success: false,
      updatedCount: 0,
      reason: 'STALE_STATE_OR_NOT_FOUND',
    };
  }

  return {
    success: true,
    updatedCount: 1,
  };
}

/**
 * Transaction helper for multi-step database mutations with explicit isolation level and automatic rollback on error.
 */
export async function withTransaction<T>(
  client: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  },
): Promise<T> {
  return client.$transaction(fn, options);
}
