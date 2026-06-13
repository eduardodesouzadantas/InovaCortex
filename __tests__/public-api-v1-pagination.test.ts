import { PublicApiError } from "../lib/public-api/v1-auth";
import { buildPublicApiPaginationMeta, encodePublicApiCursor, parsePublicApiPagination } from "../lib/public-api/v1-pagination";

describe("public api v1 pagination", () => {
    it("parses cursor pagination and falls back to page when needed", () => {
        const cursor = encodePublicApiCursor(20);
        expect(parsePublicApiPagination(new URLSearchParams({
            cursor,
            limit: "15",
        }))).toEqual({
            limit: 15,
            offset: 20,
        });

        expect(parsePublicApiPagination(new URLSearchParams({
            page: "3",
            limit: "10",
        }))).toEqual({
            limit: 10,
            offset: 20,
        });
    });

    it("builds a stable pagination meta contract", () => {
        expect(buildPublicApiPaginationMeta({
            offset: 20,
            limit: 10,
            total: 35,
            returnedCount: 10,
        })).toMatchObject({
            limit: 10,
            total: 35,
            returnedCount: 10,
            hasNextPage: true,
            nextCursor: expect.any(String),
        });
    });

    it("rejects invalid cursors", () => {
        expect(() => parsePublicApiPagination(new URLSearchParams({
            cursor: "invalid",
        }))).toThrow(PublicApiError);
    });
});
