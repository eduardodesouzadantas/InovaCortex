import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAgencyOrgSlug } from "@/lib/auth/session";
import { checkBuilderAccess } from "@/lib/builder/builder-guard";
import { logger, withApiLogging } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type TemplateListItem = Prisma.BuildTemplateGetPayload<{
    select: {
        id: true;
        key: true;
        name: true;
        description: true;
        version: true;
        createdAt: true;
    };
}>;

type UpsertTemplateBody = {
    key?: string;
    name?: string;
    description?: string;
    version?: number;
    blueprintJson?: string;
};

async function GETHandler(req: NextRequest) {
    const slug = getAgencyOrgSlug();
    const gate = await checkBuilderAccess(slug, req);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

    const templates = await prisma.buildTemplate.findMany({
        where: { orgId: gate.orgId },
        select: {
            id: true,
            key: true,
            name: true,
            description: true,
            version: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
    }).catch(() => [] as TemplateListItem[]);

    return NextResponse.json({ ok: true, templates });
}

async function PATCHHandler(req: NextRequest) {
    const slug = getAgencyOrgSlug();
    const gate = await checkBuilderAccess(slug, req);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

    let body: UpsertTemplateBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.key || !body.name || !body.blueprintJson) {
        return NextResponse.json({ error: "key, name, blueprintJson required" }, { status: 400 });
    }

    const version = body.version ?? 1;

    try {
        const template = await prisma.buildTemplate.upsert({
            where: {
                orgId_key_version: {
                    orgId: gate.orgId,
                    key: body.key,
                    version,
                },
            },
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
        const safe = {
            id: template.id,
            orgId: template.orgId,
            key: template.key,
            name: template.name,
            description: template.description,
            version: template.version,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
        };
        return NextResponse.json({ ok: true, template: safe });
    } catch (error: unknown) {
        logger.error("[Builder][Agency] Template upsert failed", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}

export const GET = withApiLogging("/api/agency/builder/templates", "GET", GETHandler);
export const PATCH = withApiLogging("/api/agency/builder/templates", "PATCH", PATCHHandler);
