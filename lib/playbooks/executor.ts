import { PLAYBOOKS, PlaybookContext } from "./registry";
import { computeActionHash, evaluatePolicy } from "./policy";

export async function runPlaybook(ctx: PlaybookContext, args: {
    playbookId: string;
    orgId: string;
    actorUserId?: string | null;
    dryRun?: boolean;
    inputJson?: any;
    resumeRunId?: string; // used when approval happens
}) {
    const { playbookId, orgId } = args;
    const def = PLAYBOOKS[playbookId as keyof typeof PLAYBOOKS];
    if (!def) throw new Error(`Unknown playbook: ${playbookId}`);

    const playbook = await ctx.db.playbook.findFirst({ where: { id: playbookId, organizationId: orgId } }).catch(() => null);

    const approvalMode = (playbook?.approvalMode ?? def.defaultApprovalMode) as "auto" | "requires_admin" | "requires_owner";

    let policy = def.defaultPolicy;
    if (playbook?.policyJson) {
        try {
            policy = { ...policy, ...JSON.parse(playbook.policyJson) };
        } catch (err) { }
    }

    const run = args.resumeRunId
        ? await ctx.db.playbookRun.findUnique({ where: { id: args.resumeRunId } })
        : await ctx.db.playbookRun.create({
            data: {
                playbookId,
                organizationId: orgId,
                status: "queued",
                actorUserId: args.actorUserId ?? null,
                dryRun: !!args.dryRun,
                inputJson: args.inputJson ? JSON.stringify(args.inputJson) : null,
            },
        });

    if (!run) throw new Error("Could not initialize PlaybookRun.");

    // Mark as running
    await ctx.db.playbookRun.update({ where: { id: run.id }, data: { status: "running", startedAt: new Date() } });

    const targets = await def.resolveTargets(ctx);

    const actionPlans: any[] = [];
    const toEnqueue: any[] = [];
    let needsApproval = false;

    const maxTargets = policy.maxTargetsPerRun || 50;
    const maxSteps = policy.maxStepsPerRun || 150;

    let targetedCount = 0;
    let steppedCount = 0;

    for (const t of targets) {
        if (targetedCount >= maxTargets) break;
        targetedCount++;

        const steps = await def.buildSteps(ctx, t);

        for (const s of steps) {
            if (steppedCount >= maxSteps) break;
            steppedCount++;

            const day = ctx.time.todayKey(orgId);
            const actionHash = computeActionHash(`${playbookId}:${t.targetId}:${day}:${s.stepKey}`);

            // Idempotency check via dedupeKey
            const already = await ctx.db.systemEvent.findUnique({ where: { dedupeKey: actionHash } });
            if (already) continue; // Skip if already planned/executed

            const step = { ...s, actionHash, requiresApproval: s.requiresApproval };
            const decision = await evaluatePolicy(ctx, { orgId, playbookId, approvalMode, policy, target: t, step });

            actionPlans.push({ targetId: t.targetId, step, decision: decision.ok ? "allowed" : "blocked", reason: decision.reason });

            if (!decision.ok) {
                // Log blocked step
                await ctx.db.auditEvent.create({
                    data: {
                        organizationId: orgId,
                        action: "playbook_step_blocked",
                        assessmentId: t.assessmentId || t.targetId || "none", // Fallback targeting
                        details: JSON.stringify({ runId: run.id, playbookId, targetId: t.targetId, step, reason: decision.reason, remediation: decision.pendingRemediation }),
                    }
                });
                continue;
            }

            if (args.dryRun) continue;

            if (decision.requiresApproval) {
                needsApproval = true;
                continue;
            }

            toEnqueue.push({
                type: "playbook_step",
                organizationId: orgId,
                payloadJson: JSON.stringify({ runId: run.id, playbookId, target: t, step }),
                priority: "medium", // Default for standard steps, can be adjusted by playbook type
            });
        }
    }

    // Dry run exits safely without side-effects
    if (args.dryRun) {
        const r = await ctx.db.playbookRun.update({
            where: { id: run.id },
            data: { status: "success", finishedAt: new Date(), resultJson: JSON.stringify({ dryRun: true, actionPlans }) },
        });
        return r;
    }

    // Human in the Loop: Pending Approval Gate
    if (needsApproval) {
        const existingApproval = await ctx.db.playbookApproval.findUnique({ where: { playbookRunId: run.id } });

        if (!existingApproval) {
            await ctx.db.playbookApproval.create({
                data: {
                    organizationId: orgId,
                    playbookRunId: run.id,
                    requestedByUserId: args.actorUserId ?? null,
                    requiredRole: approvalMode === "requires_owner" ? "owner" : "admin",
                    status: "pending",
                },
            });
        }

        const r = await ctx.db.playbookRun.update({
            where: { id: run.id },
            data: { status: "queued", resultJson: JSON.stringify({ pending: true, actionPlans }) },
        });

        await ctx.db.auditEvent.create({ data: { organizationId: orgId, action: "playbook_run_pending_approval", assessmentId: "none", details: JSON.stringify({ runId: run.id, playbookId }) } });
        return r;
    }

    // Finalize execution limits and priority overrides
    let queueCount = 0;
    for (const item of toEnqueue) {
        // Setup dynamic priority rules based on Playbook bounds
        if (playbookId === "pb_sla_breach_escalation") item.priority = "high";
        if (playbookId === "pb_daily_ceo_action_pack") item.priority = "medium";
        if (playbookId === "pb_hot_proposal_followup") item.priority = "medium";

        await ctx.db.actionQueue.create({ data: item });
        queueCount++;
    }

    const r = await ctx.db.playbookRun.update({
        where: { id: run.id },
        data: { status: "success", finishedAt: new Date(), resultJson: JSON.stringify({ enqueued: queueCount, actionPlans }) },
    });

    await ctx.db.auditEvent.create({ data: { organizationId: orgId, action: "playbook_run_success", assessmentId: "none", details: JSON.stringify({ runId: run.id, playbookId, enqueued: queueCount }) } });

    return r;
}
