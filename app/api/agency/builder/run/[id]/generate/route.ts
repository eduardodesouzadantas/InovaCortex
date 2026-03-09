/**
 * app/api/agency/builder/run/[id]/generate/route.ts
 * V26: Agency Builder canonical artifact generation endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAgencyOrgSlug } from "@/lib/auth/session";
import { checkBuilderAccess, isValidTransition } from "@/lib/builder/builder-guard";
import { logger } from "@/lib/logger";

function buildImplPlan(input: any, mode: string): string {
    const target = input.company ?? input.orgSlug ?? "Target";
    const modules = input.recommendedMissions ?? input.modules ?? ["Core setup"];
    const lines = modules.slice(0, 8).map((m: string, i: number) => `${i + 1}. ${m}`);
    return [
        `# Implementation Plan — ${target}`,
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
        "> _Generated deterministically by InovaCortex Builder Autopilot v25._",
    ].join("\n");
}

function buildPromptPack(input: any): string {
    const company = input.company ?? "Client";
    const pains = Array.isArray(input.pains) ? input.pains : [input.pains ?? "Automacao"];
    return [
        `# Prompt Pack — ${company}`,
        "",
        "## Context summary",
        `Company: ${company}`,
        `Segment: ${input.segment ?? "Unknown"}`,
        `Urgency: ${input.urgency ?? "Normal"}`,
        "",
        "## Core pain prompts",
        ...pains.map((p: string) => `- "${p}"`),
        "",
        "## Recommended agent behaviors",
        "- Always acknowledge the pain before pitching",
        "- Reference concrete ROI from similar companies",
        "- Close with a specific next step (meeting / proposal / demo)",
    ].join("\n");
}

function buildChecklist(input: any, mode: string): string {
    const items: string[] = mode === "code_patch"
        ? ["[ ] Review existing codebase", "[ ] Create migration branch", "[ ] Apply diff", "[ ] Run tests", "[ ] Deploy & verify"]
        : ["[ ] Confirm scope with client", "[ ] Validate data sources", "[ ] Kick-off call scheduled", "[ ] Acceptance criteria agreed"];
    return `# Checklist — ${input.company ?? "Run"}\n\n${items.join("\n")}`;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const slug = getAgencyOrgSlug();
    const gate = await checkBuilderAccess(slug, req);
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

    const { prisma } = await import("@/lib/prisma");
    const run = await (prisma as any).buildRun.findFirst({
        where: { id, orgId: gate.orgId },
    }).catch(() => null);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    if (!isValidTransition(run.status, "review")) {
        return NextResponse.json({ error: `Cannot generate from status: ${run.status}` }, { status: 422 });
    }

    let input: any = {};
    try { input = JSON.parse(run.inputJson); } catch { }

    const artifactDefs: { type: string; body: string }[] = [
        { type: "implementation_plan", body: buildImplPlan(input, run.mode) },
        { type: "checklist", body: buildChecklist(input, run.mode) },
    ];
    if (run.mode !== "plan_only") {
        artifactDefs.push({ type: "prompt_pack", body: buildPromptPack(input) });
    }

    const created = await Promise.all(artifactDefs.map(a =>
        (prisma as any).buildArtifact.create({
            data: { orgId: gate.orgId, buildRunId: id, type: a.type, body: a.body },
        })
    ));

    await (prisma as any).buildRun.update({
        where: { id },
        data: {
            status: "review",
            outputJson: JSON.stringify({ artifactCount: created.length, types: created.map((a: any) => a.type) }),
            updatedAt: new Date(),
        },
    });

    logger.info("[Builder][Agency] Artifacts generated", { runId: id, count: created.length });
    return NextResponse.json({ ok: true, artifacts: created }, { status: 201 });
}
