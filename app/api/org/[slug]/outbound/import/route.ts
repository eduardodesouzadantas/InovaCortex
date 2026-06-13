/**
 * app/api/org/[slug]/outbound/import/route.ts
 * V21: POST — CSV import of prospects.
 *
 * Expected CSV columns (header row required):
 *   fullName, title, company, industry, companySize, location, linkedinUrl, email, phone
 *
 * GET — Export prospects as CSV.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
} from "@/lib/auth/tenant-route";
import { logger, withApiLogging } from "@/lib/logger";

interface Params { params: Promise<{ slug: string }> }

type ProspectCsvRow = Record<string, string>;

function parseCSV(text: string): ProspectCsvRow[] {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
        return obj;
    });
}

async function POSTHandler(req: NextRequest, { params }: Params) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve outbound import context");
    }
    try {
        assertTenantRole(ctx.role, "admin");
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to authorize outbound import");
    }

    const { prisma } = await import("@/lib/prisma");

    let csvText: string;
    try {
        const ct = req.headers.get("content-type") ?? "";
        if (ct.includes("text/csv") || ct.includes("text/plain")) {
            csvText = await req.text();
        } else {
            const fd = await req.formData();
            const file = fd.get("file") as File | null;
            if (!file) return invalidTenantInputResponse("No file provided");
            csvText = await file.text();
        }
    } catch { return invalidTenantInputResponse("Could not read CSV"); }

    const rows = parseCSV(csvText);
    let created = 0, updated = 0, skipped = 0;

    for (const row of rows) {
        if (!row.linkedinUrl || !row.fullName) { skipped++; continue; }
        try {
            const existing = await prisma.prospect.findFirst({
                where: { orgId: ctx.orgId, linkedinUrl: row.linkedinUrl },
            });
            if (existing) {
                await prisma.prospect.update({
                    where: { id: existing.id },
                    data: {
                        fullName: row.fullName || existing.fullName,
                        title: row.title || existing.title,
                        company: row.company || existing.company,
                        industry: row.industry || existing.industry,
                        companySize: row.companySize || existing.companySize,
                        location: row.location || existing.location,
                        email: row.email || existing.email,
                        phone: row.phone || existing.phone,
                    },
                });
                updated++;
            } else {
                await prisma.prospect.create({
                    data: {
                        orgId: ctx.orgId,
                        fullName: row.fullName,
                        title: row.title || "—",
                        company: row.company || "—",
                        industry: row.industry || "servicos_recorrentes",
                        companySize: row.companySize || "11-50",
                        location: row.location || "",
                        linkedinUrl: row.linkedinUrl,
                        email: row.email || null,
                        phone: row.phone || null,
                        source: "import",
                        status: "new",
                    },
                });
                created++;
            }
        } catch { skipped++; }
    }

    logger.info("[OutboundImport] CSV import done", { orgSlug: slug, created, updated, skipped });
    return NextResponse.json({ message: "Import concluído", created, updated, skipped });
}

async function GETHandler(req: NextRequest, { params }: Params) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve outbound export context");
    }
    try {
        assertTenantRole(ctx.role, "admin");
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to authorize outbound export");
    }

    const { prisma } = await import("@/lib/prisma");

    const prospects = await prisma.prospect.findMany({
        where: { orgId: ctx.orgId },
        orderBy: { createdAt: "desc" },
        take: 1000,
    });

    const headers = ["fullName", "title", "company", "industry", "companySize", "location", "linkedinUrl", "email", "phone", "status", "source", "createdAt"];
    const csvLines = [
        headers.join(","),
        ...prospects.map((p) => {
            const row: Record<string, string> = {
                fullName: p.fullName,
                title: p.title,
                company: p.company,
                industry: p.industry,
                companySize: p.companySize,
                location: p.location,
                linkedinUrl: p.linkedinUrl,
                email: p.email ?? "",
                phone: p.phone ?? "",
                status: p.status,
                source: p.source,
                createdAt: p.createdAt.toISOString(),
            };

            return headers.map((header) => `"${row[header].replace(/"/g, '""')}"`).join(",");
        }),
    ];

    return new NextResponse(csvLines.join("\n"), {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="prospects-${slug}-${Date.now()}.csv"`,
        },
    });
}

export const POST = withApiLogging("/api/org/[slug]/outbound/import", "POST", POSTHandler);
export const GET = withApiLogging("/api/org/[slug]/outbound/import", "GET", GETHandler);
