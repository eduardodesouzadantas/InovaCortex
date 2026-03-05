/**
 * app/api/org/[slug]/builder/templates/route.ts
 * V25: GET (list) + PATCH (upsert) BuildTemplates.
 *
 * NEVER expose blueprint JSON to customer orgs.
 * Gated by builder-guard.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkBuilderAccess } from "@/lib/builder/builder-guard";
import { logger } from "@/lib/logger";

export async function GET(
    req: NextRequest,
    { params }: { params: { slug: string } },
) {
    const { slug } = params;
    const role = req.headers.get("x-builder-role") ?? "admin";
    const gate = await checkBuilderAccess(slug, role);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 });

    const { prisma } = await import("@/lib/prisma");
    const templates = await (prisma as any).buildTemplate.findMany({
        where: { orgId: gate.orgId },
        select: { id: true, key: true, name: true, description: true, version: true, createdAt: true },
        orderBy: { createdAt: "desc" },
    }).catch(() => []);

    // ⚠ blueprintJson intentionally EXCLUDED from response
    return NextResponse.json({ ok: true, templates });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: { slug: string } },
) {
    const { slug } = params;
    const role = req.headers.get("x-builder-role") ?? "admin";
    const gate = await checkBuilderAccess(slug, role);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 });

    let body: {
        key?: string; name?: string; description?: string;
        version?: number; blueprintJson?: string;
    };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    if (!body.key || !body.name || !body.blueprintJson) {
        return NextResponse.json({ error: "key, name, blueprintJson required" }, { status: 400 });
    }

    const version = body.version ?? 1;
    const { prisma } = await import("@/lib/prisma");

    try {
        const template = await (prisma as any).buildTemplate.upsert({
            where: { orgId_key_version: { orgId: gate.orgId, key: body.key, version } },
            create: {
                orgId: gate.orgId, key: body.key, name: body.name,
                description: body.description ?? "", version,
                blueprintJson: body.blueprintJson,
            },
            update: {
                name: body.name,
                description: body.description ?? "",
                blueprintJson: body.blueprintJson,
                updatedAt: new Date(),
            },
        });
        logger.info("[Builder] Template upserted", { key: body.key, version });
        // Return without blueprintJson
        const { blueprintJson: _, ...safe } = template;
        return NextResponse.json({ ok: true, template: safe });
    } catch (err: any) {
        logger.error("[Builder] Template upsert failed", { err: err?.message });
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
