import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
} from "@/lib/auth/tenant-route";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";

type SalesRepCreateBody = {
    email?: string;
    name?: string;
    phone?: string;
    role?: string;
};

// GET - list reps
async function GETHandler(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const p = await params;
        const { orgId } = await requireOrgContext(p.slug);
        const pagination = parsePagination(new URL(_req.url).searchParams, { defaultLimit: 25, maxLimit: 100 });
        const currentMonth = new Date().toISOString().slice(0, 7);
        const [total, reps] = await prisma.$transaction([
            prisma.salesRep.count({
                where: { organizationId: orgId },
            }),
            prisma.salesRep.findMany({
                where: { organizationId: orgId },
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    email: true,
                    role: true,
                    active: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: { select: { assignments: { where: { status: "active" } } } },
                    targets: {
                        where: { month: currentMonth },
                        take: 1,
                        select: { month: true, targetCents: true },
                    },
                },
                orderBy: [{ role: "asc" }, { name: "asc" }],
                skip: pagination.skip,
                take: pagination.limit,
            }),
        ]);
        return NextResponse.json({
            reps,
            pagination: buildPaginationMeta({ ...pagination, total }),
        });
    } catch (e: unknown) {
        return resolveTenantRouteError(e, "Failed to load sales reps");
    }
}

// POST - create rep
async function POSTHandler(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const p = await params;
        const { orgId, role } = await requireOrgContext(p.slug);
        assertTenantRole(role, "admin");

        const body = await req.json().catch(() => null) as SalesRepCreateBody | null;
        if (!body || typeof body.name !== "string" || !body.name.trim()) {
            return invalidTenantInputResponse("name is required");
        }

        const rep = await prisma.salesRep.create({
            data: {
                organizationId: orgId,
                name: body.name.trim(),
                phone: typeof body.phone === "string" ? body.phone : null,
                email: typeof body.email === "string" ? body.email : null,
                role: typeof body.role === "string" && body.role.trim() ? body.role : "SDR"
            },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                role: true,
                active: true,
                createdAt: true,
            },
        });
        return NextResponse.json({ rep }, { status: 201 });
    } catch (e: unknown) {
        return resolveTenantRouteError(e, "Failed to create sales rep");
    }
}

export const GET = withApiLogging("/api/org/[slug]/sales/reps", "GET", GETHandler);
export const POST = withApiLogging("/api/org/[slug]/sales/reps", "POST", POSTHandler);
