import type { NextResponse } from "next/server";

export function applyCommercialAdminAdapterHeaders<T extends NextResponse>(response: T): T {
    response.headers.set("Deprecation", "true");
    response.headers.set("Sunset", "Wed, 30 Sep 2026 23:59:59 GMT");
    response.headers.set("Link", "</api/agency/commercial>; rel=\"successor-version\"");
    response.headers.set("X-Inova-Legacy-Adapter", "admin-commercial-api");
    return response;
}
