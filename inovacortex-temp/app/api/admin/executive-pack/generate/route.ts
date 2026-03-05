/**
 * app/api/admin/executive-pack/generate/route.ts
 * V24: POST — Generate an executive pack for an org.
 *
 * Body: { orgId: string; anonymized?: boolean }
 * RBAC: admin token
 */

import { NextRequest, NextResponse } from "next/server";
import { buildExecPack } from "@/lib/executive-pack/pack-builder";
import { logger } from "@/lib/logger";
import { nanoid } from "nanoid";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const adminToken = req.headers.get("x-admin-token");
    if (!adminToken || adminToken !== process.env.ADMIN_SECRET_TOKEN) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { orgId?: string; anonymized?: boolean };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    if (!body.orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    logger.info("[ExecPack] Building pack", { orgId: body.orgId });

    try {
        const payload = await buildExecPack(body.orgId, body.anonymized ?? false);
        const slug = nanoid(10);

        const { prisma } = await import("@/lib/prisma");
        const pack = await (prisma as any).execPack.create({
            data: {
                id: slug,
                orgId: body.orgId,
                publicSlug: slug,
                status: "ready",
                payloadJson: JSON.stringify(payload),
                anonymized: body.anonymized ?? false,
            },
        });

        // Audit
        await (prisma as any).auditEvent.create({
            data: {
                assessmentId: "system",
                organizationId: body.orgId,
                action: "execPackGenerated",
                details: JSON.stringify({ slug, anonymized: body.anonymized }),
            },
        }).catch(() => null);

        logger.info("[ExecPack] Ready", { slug });
        return NextResponse.json({ ok: true, id: slug, slug }, { status: 201 });

    } catch (err: any) {
        logger.error("[ExecPack] Failed", { err: err?.message });
        return NextResponse.json({ error: "Generation failed", detail: err?.message }, { status: 500 });
    }
}
