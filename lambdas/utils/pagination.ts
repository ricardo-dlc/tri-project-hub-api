interface PaginationOptions {
  limit?: number;
  nextToken?: string;
  defaultLimit?: number;
}

interface PaginationResult<T> {
  data: T[];
  pagination: {
    hasNextPage: boolean;
    nextToken: string | null;
    limit: number;
    count: number;
  };
}

/**
 * Applies pagination logic to ElectroDB query results
 * @param queryResult - The result from an ElectroDB query
 * @param options - Pagination options
 * @returns Paginated result with metadata
 */
export function applyPagination<T>(
  queryResult: { data: T[]; cursor: string | null },
  options: PaginationOptions = {}
): PaginationResult<T> {
  const { limit, defaultLimit = 20 } = options;
  const pageLimit = limit ? parseInt(String(limit), 10) : defaultLimit;

  // Check if we got more items than requested (we fetch pageLimit + 1)
  const hasNextPage = queryResult.data.length > pageLimit;
  const itemsToReturn = hasNextPage
    ? queryResult.data.slice(0, pageLimit)
    : queryResult.data;

  return {
    data: itemsToReturn,
    pagination: {
      hasNextPage,
      nextToken: hasNextPage ? queryResult.cursor : null,
      limit: pageLimit,
      count: itemsToReturn.length,
    },
  };
}

/**
 * Executes a query with pagination support
 * @param query - ElectroDB query builder
 * @param options - Pagination options
 * @returns Promise of paginated result
 */
export async function executeWithPagination<T>(
  query: any,
  options: PaginationOptions = {}
): Promise<PaginationResult<T>> {
  const { limit, nextToken, defaultLimit = 20 } = options;
  const pageLimit = limit ? parseInt(String(limit), 10) : defaultLimit;

  // Fetch one extra item to check if there's a next page
  const result = await query.go({
    limit: pageLimit + 1,
    ...(nextToken ? { cursor: nextToken } : {}),
  });

  return applyPagination(result, { limit: pageLimit });
}