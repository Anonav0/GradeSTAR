import { z } from 'zod';
import { ProblemDifficulty } from '@gradestar/shared';

/**
 * Zod validation schema for GET /api/v1/problems query parameters.
 * Enforces strict typing, defaults, and boundary limits.
 */
export const listProblemsQuerySchema = z.object({
  page: z.coerce
    .number({ invalid_type_error: 'Page must be a valid number' })
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: 'Limit must be a valid number' })
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(50, 'Limit cannot exceed 50')
    .default(10),
  difficulty: z
    .nativeEnum(ProblemDifficulty, {
      errorMap: () => ({ message: 'Difficulty must be one of: EASY, MEDIUM, HARD' }),
    })
    .optional(),
  sortBy: z
    .enum(['createdAt', 'title', 'difficulty'], {
      errorMap: () => ({ message: 'sortBy must be one of: createdAt, title, difficulty' }),
    })
    .default('createdAt'),
  sortOrder: z
    .enum(['asc', 'desc'], {
      errorMap: () => ({ message: 'sortOrder must be either asc or desc' }),
    })
    .default('desc'),
  q: z
    .string()
    .trim()
    .min(1, 'Search query must be at least 1 character')
    .max(100, 'Search query cannot exceed 100 characters')
    .optional(),
});

/**
 * Zod validation schema for GET /api/v1/problems/:slug path parameters.
 * Enforces URL-friendly kebab-case format and length constraints.
 */
export const problemSlugParamSchema = z.object({
  slug: z
    .string({ required_error: 'Problem slug is required' })
    .trim()
    .min(1, 'Slug must not be empty')
    .max(100, 'Slug cannot exceed 100 characters')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be valid kebab-case (lowercase alphanumeric and hyphens)',
    ),
});

export type ListProblemsQuery = z.infer<typeof listProblemsQuerySchema>;
export type ProblemSlugParam = z.infer<typeof problemSlugParamSchema>;
