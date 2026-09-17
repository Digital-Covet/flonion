/**
 * Pagination helpers for the desk.
 *
 * Every sort must append an id tiebreaker or offset pagination duplicates and
 * skips rows. Reference: revme-ai/src/lib/partners-query.ts.
 */

export interface PageParams {
  page: number;
  size: number;
  sort: string;
  dir: "asc" | "desc";
}

export interface PageResult<T> {
  rows: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

const MAX_SIZE = 100;
const DEFAULT_SIZE = 25;
const VALID_SORTS: Record<string, string> = {};

export function parsePageParams(
  searchParams: URLSearchParams,
  validSorts: Record<string, string> = VALID_SORTS,
  defaultSort = "createdAt",
): PageParams {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const size = Math.min(MAX_SIZE, Math.max(1, Number.parseInt(searchParams.get("size") ?? String(DEFAULT_SIZE), 10) || DEFAULT_SIZE));
  const sortKey = searchParams.get("sort") ?? defaultSort;
  const sort = validSorts[sortKey] ?? defaultSort;
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  return { page, size, sort, dir };
}

export function offset(params: PageParams): number {
  return (params.page - 1) * params.size;
}

/**
 * Build the Prisma `orderBy` array with an id tiebreaker to prevent
 * duplicates across pages.
 */
export function orderBy(
  sort: string,
  dir: "asc" | "desc",
): Array<Record<string, "asc" | "desc">> {
  return [{ [sort]: dir }, { id: "asc" }];
}

/**
 * Escape `%` and `_` so LIKE searches treat them as literals.
 */
export function likeTerm(term: string): string {
  return term.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Wrap raw text search results into the page shape.
 */
export function pageResult<T>(
  rows: T[],
  total: number,
  params: PageParams,
): PageResult<T> {
  return {
    rows,
    total,
    page: params.page,
    size: params.size,
    totalPages: Math.ceil(total / params.size),
  };
}
