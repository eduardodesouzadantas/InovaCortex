/**
 * lib/builder/builder-guard.ts
 * V25: Internal Builder Autopilot — gating + RBAC utilities.
 *
 * Gating rules (AND):
 *   1. org.slug === "inovacortex"  OR  SystemSetting internal_builder_enabled = "true"
 *   2. Session user role must be "owner" or "admin"
 *
 * Never expose to customer-facing routes.
 */

export const INTERNAL_ORG_SLUG = "inovacortex";
export const SETTING_KEY = "internal_builder_enabled";

export type BuilderAccessResult =
    | { allowed: true; orgId: string }
    | { allowed: false; reason: string };

/**
 * Checks whether the requesting user/org is allowed to use the Builder.
 * Call this at the top of every builder API route.
 *
 * @param orgSlug  — URL param [slug]
 * @param userRole — session role (owner | admin | closer | viewer)
 */
export async function checkBuilderAccess(
    orgSlug: string,
    userRole: string,
): Promise<BuilderAccessResult> {
    // RBAC: only owner or admin
    if (!["owner", "admin"].includes(userRole)) {
        return { allowed: false, reason: "RBAC: owner or admin required" };
    }

    const { prisma } = await import("@/lib/prisma");

    // Resolve org
    const org = await (prisma as any).organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true, slug: true },
    }).catch(() => null);

    if (!org) return { allowed: false, reason: "Org not found" };

    // Gate 1: internal org slug
    if (org.slug === INTERNAL_ORG_SLUG) {
        return { allowed: true, orgId: org.id };
    }

    // Gate 2: AppSetting flag
    const setting = await (prisma as any).appSetting.findUnique({
        where: { key: SETTING_KEY },
    }).catch(() => null);


    if (setting?.value === "true") {
        return { allowed: true, orgId: org.id };
    }

    return { allowed: false, reason: "Builder not enabled for this org" };
}

/**
 * Reads the x-admin-token header and validates it.
 * Convenience for routes that accept token-based admin auth.
 */
export function isAdminToken(tokenHeader: string | null): boolean {
    return !!tokenHeader && tokenHeader === process.env.ADMIN_SECRET_TOKEN;
}

// ─── Status machine ───────────────────────────────────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ["review", "failed"],
    review: ["approved", "draft", "failed"],
    approved: ["executing", "draft", "failed"],
    executing: ["done", "failed"],
    done: [],
    failed: ["draft"],
};

export function isValidTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export const ALL_BUILD_MODES = ["plan_only", "prompt_pack", "code_patch"] as const;
export const ALL_ARTIFACT_TYPES = ["implementation_plan", "prompt_pack", "diff_plan", "checklist"] as const;

export type BuildMode = typeof ALL_BUILD_MODES[number];
export type ArtifactType = typeof ALL_ARTIFACT_TYPES[number];
