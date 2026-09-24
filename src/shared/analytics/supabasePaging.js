/**
 * @file Helpers for reading more rows out of Supabase than one request
 * allows: paging past PostgREST's default 1000-row cap, and splitting a long
 * `in (...)` list so the request URL doesn't overflow.
 *
 * @remarks
 * Used by the services that read a course's attendance history in bulk
 * (`lecturer/courses/courseStatsService.js`,
 * `lecturer/course-details/courseDetailsService.js`,
 * `lecturer/roster/rosterService.js`) — a course with a few hundred students
 * and a few dozen sessions has well over 1000 `session_attendance` rows, and
 * a plain `.select()` would silently drop the rest, understating every
 * percentage. They were private to `courseStatsService` until a second and
 * third service needed them.
 *
 * Every query passed in should be ordered by a stable key, or `range()`
 * paging can repeat or skip rows.
 */

const PAGE_SIZE = 1000;
const IN_CHUNK_SIZE = 100;

/**
 * Throws a 500 error from a Supabase error object.
 *
 * @param {{ message?: string }|null} error
 * @param {string} fallback - Message when the error has none.
 * @throws {Error} Always, with `statusCode` 500.
 */
export const failWith = (error, fallback) => {
  const err = new Error(error?.message || fallback);
  err.statusCode = 500;
  throw err;
};

/**
 * Reads every row of a query, a page at a time.
 *
 * @param {() => import("@supabase/supabase-js").PostgrestFilterBuilder} buildQuery - Builds a fresh, ordered query each call.
 * @param {string} fallbackMessage - Error message if a page fails without one.
 * @returns {Promise<object[]>} All rows.
 */
export async function fetchAllPages(buildQuery, fallbackMessage) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) failWith(error, fallbackMessage);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

/**
 * Like {@link fetchAllPages}, for a query filtered by a potentially long id
 * list: runs it once per chunk of ids and concatenates the results.
 *
 * @param {string[]} ids - The ids to filter by.
 * @param {(idChunk: string[]) => import("@supabase/supabase-js").PostgrestFilterBuilder} buildQuery - Builds the query for one chunk of ids.
 * @param {string} fallbackMessage
 * @returns {Promise<object[]>} All rows across every chunk.
 */
export async function fetchInChunks(ids, buildQuery, fallbackMessage) {
  const rows = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    rows.push(...(await fetchAllPages(() => buildQuery(ids.slice(i, i + IN_CHUNK_SIZE)), fallbackMessage)));
  }
  return rows;
}
