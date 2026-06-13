import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAgencyOrgSlug } from "@/lib/auth/session";
import { checkBuilderAccess, ALL_BUILD_MODES, type BuildMode } from "@/lib/builder/builder-guard";
import { logger, withApiLogging } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { profileRequest, profileStep } from "@/lib/request-profiler";

const BUILDER_RUNS_CACHE_TTL_MS = 15_000;

type BuilderRunListItem = Prisma.BuildRunGetPayload<{
    select: {
        id: true;
        orgId: true;
        targetOrgSlug: true;
        targetWorkspaceId: true;
        mode: true;
        status: true;
        inputJson: true;
        outputJson: true;
        createdAt: true;
        updatedAt: true;
        artifacts: {
            select: {
                id: true;
                type: true;
                version: true;
                createdAt: true;
            };
        };
    };
}>;

type CreateRunBody = {
    mode?: string;
    inputJson?: string;
    targetOrgSlug?: string;
    targetWorkspaceId?: string;
};

const builderRunsCache = new Map<string, { expiresAt: number; runs: BuilderRunListItem[] }>();

function isBuildMode(value: string): value is BuildMode {
    return (ALL_BUILD_MODES as readonly string[]).includes(value);
}

async function POSTHandler(req: NextRequest) {
    return profileRequest({ route: "/api/agency/builder/run", method: "POST", targetMs: 500 }, async () => {
        const slug = getAgencyOrgSlug();
        const gate = await profileStep("builder.access", () => checkBuilderAccess(slug, req));
        if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

        let body: CreateRunBody;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }

        if (!body.mode || !isBuildMode(body.mode)) {
            return NextResponse.json({ error: `mode must be one of: ${ALL_BUILD_MODES.join(", ")}` }, { status: 400 });
        }
        if (!body.inputJson) {
            return NextResponse.json({ error: "inputJson required" }, { status: 400 });
        }
        const mode = body.mode;
        const inputJson = body.inputJson;

        try {
            const run = await profileStep("builder.create_run", () => prisma.buildRun.create({
                data: {
                    orgId: gate.orgId,
                    mode,
                    status: "draft",
                    inputJson,
                    targetOrgSlug: body.targetOrgSlug ?? null,
                    targetWorkspaceId: body.targetWorkspaceId ?? null,
                },
            }));

            builderRunsCache.delete(gate.orgId);
            logger.info("[Builder][Agency] RunCreated", { runId: run.id, mode: run.mode });
            return NextResponse.json({ ok: true, run }, { status: 201 });
        } catch (error: unknown) {
            logger.error("[Builder][Agency] RunCreate failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            return NextResponse.json({ error: "Failed to create run" }, { status: 500 });
        }
    });
}

async function GETHandler(req: NextRequest) {
    return profileRequest({ route: "/api/agency/builder/run", method: "GET", targetMs: 500 }, async () => {
        const slug = getAgencyOrgSlug();
        const gate = await profileStep("builder.access", () => checkBuilderAccess(slug, req));
        if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

        const cached = builderRunsCache.get(gate.orgId);
        if (cached && cached.expiresAt > Date.now()) {
            return NextResponse.json({ ok: true, runs: cached.runs });
        }

        const runs = await profileStep("builder.load_runs", () => prisma.buildRun.findMany({
            where: { orgId: gate.orgId },
            select: {
                id: true,
                orgId: true,
                targetOrgSlug: true,
                targetWorkspaceId: true,
                mode: true,
                status: true,
                inputJson: true,
                outputJson: true,
                createdAt: true,
                updatedAt: true,
                artifacts: {
                    select: { id: true, type: true, version: true, createdAt: true },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        }).catch(() => [] as BuilderRunListItem[]));

        builderRunsCache.set(gate.orgId, {
            expiresAt: Date.now() + BUILDER_RUNS_CACHE_TTL_MS,
            runs,
        });

        return NextResponse.json({ ok: true, runs });
    });
}

export const POST = withApiLogging("/api/agency/builder/run", "POST", POSTHandler);
export const GET = withApiLogging("/api/agency/builder/run", "GET", GETHandler);
