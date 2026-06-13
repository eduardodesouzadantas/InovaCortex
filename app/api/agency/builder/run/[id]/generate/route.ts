import { NextRequest, NextResponse } from "next/server";
import { getAgencyOrgSlug } from "@/lib/auth/session";
import { checkBuilderAccess, isValidTransition } from "@/lib/builder/builder-guard";
import { logger, withApiLogging } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type BuilderInput = {
    company?: string;
    orgSlug?: string;
    segment?: string;
    urgency?: string;
    pains?: string[] | string;
    recommendedMissions?: string[];
    modules?: string[];
};

function parseRunInput(inputJson: string): BuilderInput {
    try {
        const parsed = JSON.parse(inputJson) as unknown;
        return typeof parsed === "object" && parsed !== null ? parsed as BuilderInput : {};
    } catch {
        return {};
    }
}

function toStringArray(values: string[] | string | undefined): string[] {
    if (Array.isArray(values)) return values.filter((value) => typeof value === "string");
    if (typeof values === "string" && values.trim().length > 0) return [values];
    return [];
}

function buildImplPlan(input: BuilderInput, mode: string): string {
    const target = input.company ?? input.orgSlug ?? "Target";
    const modules = toStringArray(input.recommendedMissions ?? input.modules);
    const lines = (modules.length ? modules : ["Core setup"]).slice(0, 8).map((module, index) => `${index + 1}. ${module}`);

    return [
        `# Implementation Plan - ${target}`,
        `Mode: \`${mode}\`  |  Generated: ${new Date().toISOString()}`,
        "",
        "## Scope",
        lines.join("\n"),
        "",
        "## Milestones",
        "- Week 1: Environment setup + base agents",
        "- Week 2: Core integrations",
        "- Week 3: QA & review",
        "- Week 4: Go-live",
        "",
        "> Generated deterministically by InovaCortex Builder Autopilot.",
    ].join("\n");
}

function buildPromptPackArtifact(input: BuilderInput): string {
    const company = input.company ?? "Client";
    const pains = toStringArray(input.pains);

    return [
        `# Prompt Pack - ${company}`,
        "",
        "## Context summary",
        `Company: ${company}`,
        `Segment: ${input.segment ?? "Unknown"}`,
        `Urgency: ${input.urgency ?? "Normal"}`,
        "",
        "## Core pain prompts",
        ...(pains.length ? pains.map((pain) => `- "${pain}"`) : ['- "Automacao"']),
        "",
        "## Recommended agent behaviors",
        "- Always acknowledge the pain before pitching",
        "- Reference concrete ROI from similar companies",
        "- Close with a specific next step (meeting / proposal / demo)",
    ].join("\n");
}

function buildChecklist(input: BuilderInput, mode: string): string {
    const items = mode === "code_patch"
        ? ["[ ] Review existing codebase", "[ ] Create migration branch", "[ ] Apply diff", "[ ] Run tests", "[ ] Deploy & verify"]
        : ["[ ] Confirm scope with client", "[ ] Validate data sources", "[ ] Kick-off call scheduled", "[ ] Acceptance criteria agreed"];

    return `# Checklist - ${input.company ?? "Run"}\n\n${items.join("\n")}`;
}

async function POSTHandler(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const slug = getAgencyOrgSlug();
    const gate = await checkBuilderAccess(slug, req);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

    const run = await prisma.buildRun.findFirst({
        where: { id, orgId: gate.orgId },
        select: { id: true, mode: true, status: true, inputJson: true },
    }).catch(() => null);

    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    if (!isValidTransition(run.status, "review")) {
        return NextResponse.json({ error: `Cannot generate from status: ${run.status}` }, { status: 422 });
    }

    const input = parseRunInput(run.inputJson);
    const artifactDefs: Array<{ type: string; body: string }> = [
        { type: "implementation_plan", body: buildImplPlan(input, run.mode) },
        { type: "checklist", body: buildChecklist(input, run.mode) },
    ];

    if (run.mode !== "plan_only") {
        artifactDefs.push({ type: "prompt_pack", body: buildPromptPackArtifact(input) });
    }

    const created = await Promise.all(artifactDefs.map((artifact) => prisma.buildArtifact.create({
        data: {
            orgId: gate.orgId,
            buildRunId: id,
            type: artifact.type,
            body: artifact.body,
        },
    })));

    await prisma.buildRun.update({
        where: { id },
        data: {
            status: "review",
            outputJson: JSON.stringify({
                artifactCount: created.length,
                types: created.map((artifact) => artifact.type),
            }),
            updatedAt: new Date(),
        },
    });

    logger.info("[Builder][Agency] Artifacts generated", { runId: id, count: created.length });
    return NextResponse.json({ ok: true, artifacts: created }, { status: 201 });
}

export const POST = withApiLogging("/api/agency/builder/run/[id]/generate", "POST", POSTHandler);
