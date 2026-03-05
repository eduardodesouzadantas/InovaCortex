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
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { logger } from "@/lib/logger";

interface Params { params: { slug: string } }

function parseCSV(text: string): Record<string, string>[] {
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

export async function POST(req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions as any).catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { prisma } = await import("@/lib/prisma");
    const org = await (prisma as any).organization.findUnique({
        where: { slug: params.slug }, select: { id: true },
    }).catch(() => null);
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    let csvText: string;
    try {
        const ct = req.headers.get("content-type") ?? "";
        if (ct.includes("text/csv") || ct.includes("text/plain")) {
            csvText = await req.text();
        } else {
            const fd = await req.formData();
            const file = fd.get("file") as File | null;
            if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
            csvText = await file.text();
        }
    } catch { return NextResponse.json({ error: "Could not read CSV" }, { status: 400 }); }

    const rows = parseCSV(csvText);
    let created = 0, updated = 0, skipped = 0;

    for (const row of rows) {
        if (!row.linkedinUrl || !row.fullName) { skipped++; continue; }
        try {
            const existing = await (prisma as any).prospect.findFirst({
                where: { orgId: org.id, linkedinUrl: row.linkedinUrl },
            });
            if (existing) {
                await (prisma as any).prospect.update({
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
                await (prisma as any).prospect.create({
                    data: {
                        orgId: org.id,
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

    logger.info("[OutboundImport] CSV import done", { orgSlug: params.slug, created, updated, skipped });
    return NextResponse.json({ message: "Import concluído", created, updated, skipped });
}

export async function GET(req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions as any).catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { prisma } = await import("@/lib/prisma");
    const org = await (prisma as any).organization.findUnique({
        where: { slug: params.slug }, select: { id: true },
    }).catch(() => null);
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    const prospects = await (prisma as any).prospect.findMany({
        where: { orgId: org.id },
        orderBy: { createdAt: "desc" },
        take: 1000,
    }).catch(() => []);

    const headers = ["fullName", "title", "company", "industry", "companySize", "location", "linkedinUrl", "email", "phone", "status", "source", "createdAt"];
    const csvLines = [
        headers.join(","),
        ...prospects.map((p: any) =>
            headers.map(h => `"${String(p[h] ?? "").replace(/"/g, '""')}"`).join(",")
        ),
    ];

    return new NextResponse(csvLines.join("\n"), {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="prospects-${params.slug}-${Date.now()}.csv"`,
        },
    });
}
