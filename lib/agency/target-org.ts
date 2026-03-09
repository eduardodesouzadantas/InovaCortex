import { prisma } from "@/lib/prisma";

function normalize(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export async function resolveTargetOrgId(input: {
    requestUrl: string;
    defaultOrgId: string;
    bodyOrgId?: string | null;
}): Promise<string> {
    const url = new URL(input.requestUrl);
    const candidate = normalize(input.bodyOrgId)
        ?? normalize(url.searchParams.get("orgId"))
        ?? normalize(url.searchParams.get("org"));

    if (!candidate) return input.defaultOrgId;

    const byId = await prisma.organization.findUnique({
        where: { id: candidate },
        select: { id: true },
    });
    if (byId) return byId.id;

    const bySlug = await prisma.organization.findUnique({
        where: { slug: candidate },
        select: { id: true },
    });
    if (bySlug) return bySlug.id;

    throw new Error("ORG_NOT_FOUND");
}
