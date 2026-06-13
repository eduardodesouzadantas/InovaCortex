export type PaginationOptions = {
    defaultLimit?: number;
    maxLimit?: number;
    defaultPage?: number;
};

export type PaginationParams = {
    page: number;
    limit: number;
    skip: number;
};

export type PaginationMeta = PaginationParams & {
    total: number;
    pageCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
};

function parsePositiveInt(value: string | null, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePagination(
    searchParams: URLSearchParams,
    options: PaginationOptions = {},
): PaginationParams {
    const defaultPage = options.defaultPage ?? 1;
    const defaultLimit = options.defaultLimit ?? 25;
    const maxLimit = options.maxLimit ?? 100;

    const page = parsePositiveInt(searchParams.get("page"), defaultPage);
    const requestedLimit = parsePositiveInt(searchParams.get("limit"), defaultLimit);
    const limit = Math.min(maxLimit, requestedLimit);

    return {
        page,
        limit,
        skip: (page - 1) * limit,
    };
}

export function buildPaginationMeta(input: PaginationParams & { total: number }): PaginationMeta {
    const pageCount = input.total > 0 ? Math.ceil(input.total / input.limit) : 0;

    return {
        ...input,
        pageCount,
        hasNextPage: input.page < pageCount,
        hasPreviousPage: input.page > 1 && pageCount > 0,
    };
}
