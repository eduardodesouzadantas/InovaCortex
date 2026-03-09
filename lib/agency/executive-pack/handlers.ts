/* eslint-disable @typescript-eslint/no-explicit-any */
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { buildExecPack } from "@/lib/executive-pack/pack-builder";
import { writeAuditEvent } from "@/lib/audit";

export async function generateExecutivePack(input: {
    orgId: string;
    anonymized: boolean;
}): Promise<{ ok: true; id: string; slug: string }> {
    const payload = await buildExecPack(input.orgId, input.anonymized);
    const slug = nanoid(10);

    await (prisma as any).execPack.create({
        data: {
            id: slug,
            orgId: input.orgId,
            publicSlug: slug,
            status: "ready",
            payloadJson: JSON.stringify(payload),
            anonymized: input.anonymized,
        },
    });

    await writeAuditEvent({
        organizationId: input.orgId,
        action: "execPackGenerated",
        details: { slug, anonymized: input.anonymized },
        strict: true,
        context: { slug },
    });

    return { ok: true, id: slug, slug };
}

export async function getExecutivePack(id: string): Promise<
    { ok: true; pack: unknown; meta: { status: string; generatedAt: string } } | null
> {
    const pack = await (prisma as any).execPack.findFirst({
        where: { OR: [{ id }, { publicSlug: id }] },
    });
    if (!pack) return null;

    return {
        ok: true,
        pack: JSON.parse(pack.payloadJson),
        meta: { status: pack.status, generatedAt: pack.generatedAt },
    };
}
