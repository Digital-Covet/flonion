interface PaginationProps {
  page: number;
  totalPages: number;
  baseUrl: string;
  searchParams?: Record<string, string>;
}

export function Pagination({
  page,
  totalPages,
  baseUrl,
  searchParams = {},
}: PaginationProps) {
  if (totalPages <= 1) return null;

  function href(p: number) {
    const url = new URL(baseUrl, "http://localhost");
    url.searchParams.set("page", String(p));
    for (const [k, v] of Object.entries(searchParams)) {
      if (v) url.searchParams.set(k, v);
    }
    return url.pathname + url.search;
  }

  return (
    <div className="flex items-center gap-2 text-sm mt-4">
      {page > 1 && (
        <a href={href(page - 1)} className="text-blue-600 hover:underline">
          &larr; Prev
        </a>
      )}
      <span className="text-gray-500">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <a href={href(page + 1)} className="text-blue-600 hover:underline">
          Next &rarr;
        </a>
      )}
    </div>
  );
}
