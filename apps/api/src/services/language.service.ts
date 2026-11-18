import { type DbClient } from '@gradestar/database';
import type { EnabledLanguagesResult } from '@gradestar/shared';

/**
 * Retrieves all enabled programming languages for problem submission.
 * Disabled languages and internal execution parameters are strictly omitted.
 *
 * @param client Database client or transaction client
 */
export async function getEnabledLanguages(client: DbClient): Promise<EnabledLanguagesResult> {
  const items = await client.language.findMany({
    where: {
      isEnabled: true,
    },
    orderBy: [{ name: 'asc' }, { slug: 'asc' }],
    select: {
      name: true,
      slug: true,
      version: true,
    },
  });

  return { items };
}
