import { z } from 'zod';

/**
 * Reusable schema for paginated API query parameters.
 * Coerces string query values to positive integers with upper bounds.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive('Page must be a positive integer').default(1),
  limit: z.coerce
    .number()
    .int()
    .positive('Limit must be a positive integer')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid('ID must be a valid UUID'),
});

export const slugParamSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be valid kebab-case'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type SlugParam = z.infer<typeof slugParamSchema>;
