/**
 * app/api/agency/builder/templates/route.ts
 * V26: Agency Builder canonical template list/upsert endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAgencyOrgSlug } from "@/lib/auth/session";
import { checkBuilderAccess } from "@/lib/builder/builder-guard";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
    const slug = getAgencyOrgSlug();
    const gate = await checkBuilderAccess(slug, req);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

    const { prisma } = await import("@/lib/prisma");
    const templates = await (prisma as any).buildTemplate.findMany({
        where: { orgId: gate.orgId },
        select: { id: true, key: true, name: true, description: true, version: true, createdAt: true },
        orderBy: { createdAt: "desc" },
    }).catch(() => []);

    return NextResponse.json({ ok: true, templates });
}

export async function PATCH(req: NextRequest) {
    const slug = getAgencyOrgSlug();
    const gate = await checkBuilderAccess(slug, req);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

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
                orgId: gate.orgId,
                key: body.key,
                name: body.name,
                description: body.description ?? "",
                version,
                blueprintJson: body.blueprintJson,
            },
            update: {
                name: body.name,
                description: body.description ?? "",
                blueprintJson: body.blueprintJson,
                updatedAt: new Date(),
            },
        });
        logger.info("[Builder][Agency] Template upserted", { key: body.key, version });
        const { blueprintJson: _ignored, ...safe } = template;
        return NextResponse.json({ ok: true, template: safe });
    } catch (err: any) {
        logger.error("[Builder][Agency] Template upsert failed", { err: err?.message });
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
