import { prisma } from "@/lib/prisma";
import { ActionPayload, OrchestratorContext } from "./types";
import { evaluatePolicies } from "./policies";
import { runReviewerAgent } from "./reviewer";
import { runPlannerAgent } from "./planner";
import { getAgent } from "./registry";
import crypto from "crypto";
import { calibrateCloseProbability } from "@/lib/calibration-engine";
import { calculateExpectedRevenue } from "@/lib/expected-revenue";
import { shouldEscalateProposal } from "@/lib/timing-engine";
import { decideStrategy, type StrategyInput } from "@/lib/services/deal-optimization/strategy-engine";


export class Orchestrator {

    /**
     * Ask the Planner agent to look at org context and recommend actions.
     */
    static async plan(ctx: OrchestratorContext): Promise<ActionPayload[]> {
        return runPlannerAgent(ctx);
    }

    /**
     * Safe enqueue an action. Computes idempotency hash.
     */
    static async enqueue(action: ActionPayload, ctx: OrchestratorContext) {
        // Enforce lock/lease defaults
        const payloadString = JSON.stringify(action.payloadJson);
        const actionInputHash = crypto.createHash('sha256')
            .update(`${action.type}:${action.relatedEntityId || ''}:${payloadString}`)
            .digest('hex');

        // Check idempotency for external things if needed based on relatedEntity
        // For now, simply enqueue it. Multiple enqueues generate multiple queue items
        // Wait, instructions say: "Toda ação tem inputHash pra não duplicar." -> Wait ActionQueue doesn't have inputHash, AgentRun does.
        // Let's create the queue item.

        const q = await prisma.actionQueue.create({
            data: {
                organizationId: ctx.orgId,
                type: action.type,
                payloadJson: payloadString,
                priority: action.priority || "medium",
                relatedEntityType: action.relatedEntityType,
                relatedEntityId: action.relatedEntityId,
                status: "pending",
                approvalRequired: action.approvalRequired || false,
            }
        });

        // Generate Audit Event for queuing
        await prisma.auditEvent.create({
            data: {
                organizationId: ctx.orgId,
                action: "actionQueued",
                details: `Enqueued ${action.type}`,
                assessmentId: action.relatedEntityId || "none"
            }
        });

        return q;
    }

    /**
     * Processes pending items in the queue. 
     * Runs policy -> reviewer -> and blocks or auto-executes.
     */
    static async processQueue(orgId: string) {
        const runId = crypto.randomUUID();
        const now = new Date();
        const lockExpiration = new Date(now.getTime() + 5 * 60000); // 5 mins lock

        // 1. Lock pending items
        await prisma.actionQueue.updateMany({
            where: {
                organizationId: orgId,
                status: "pending",
                OR: [
                    { lockedUntil: null },
                    { lockedUntil: { lt: now } }
                ]
            },
            data: {
                lockedByRunId: runId,
                lockedUntil: lockExpiration,
                attempts: { increment: 1 }
            }
        });

        // 2. Fetch locked items
        const lockedItems = await prisma.actionQueue.findMany({
            where: { lockedByRunId: runId }
        });

        // 3. Process each
        for (const item of lockedItems) {
            const ctx: OrchestratorContext = { orgId };
            const payloadDate = JSON.parse(item.payloadJson);

            // A. Evaluate Policies
            const policies = await evaluatePolicies({ ...item, payloadJson: payloadDate } as ActionPayload, ctx);

            // Log policy decisions
            for (const p of policies) {
                await prisma.policyDecision.create({
                    data: {
                        organizationId: orgId,
                        actionQueueId: item.id,
                        policyName: p.policyName,
                        decision: p.decision,
                        explanation: p.explanation
                    }
                });
            }

            const blocks = policies.filter(p => p.decision === "block");
            if (blocks.length > 0) {
                await this.markItemRejected(item.id, `Blocked by policies: ${blocks.map(b => b.policyName).join(",")}`);
                continue;
            }

            // B. Run Reviewer Gate
            const review = await runReviewerAgent({ ...item, payloadJson: payloadDate } as ActionPayload, ctx);

            if (review.approvalRequired || policies.some(p => p.decision === "review")) {
                await prisma.actionQueue.update({
                    where: { id: item.id },
                    data: {
                        status: "review_required",
                        approvalRequired: true,
                        reason: review.riskFlags.join(" | ") || "Requires manual review",
                        lockedByRunId: null,
                        lockedUntil: null
                    }
                });

                // Audit
                await prisma.auditEvent.create({
                    data: { organizationId: orgId, action: "sentToReview", assessmentId: item.relatedEntityId || "none" }
                });
                continue;
            }

            // C. Auto-execute if internal and approved
            if (review.approved) {
                await this.executeAction(item.id, orgId);
            }
        }
    }

    /**
     * Executes an approved action via Registry.
     */
    static async executeAction(queueId: string, orgId: string, approvedByUserId?: string) {
        const item = await prisma.actionQueue.findUnique({ where: { id: queueId } });
        if (!item) return;

        // Try getting Agent from registry based on type mappings
        // Eg: start_sequence -> FunnelAgent
        const agentName = this.mapTypeToAgent(item.type);
        const agent = getAgent(agentName);

        if (!agent) {
            await this.markItemRejected(queueId, `System Error: No agent registered for ${agentName}`);
            return;
        }

        // Run agent
        const runId = crypto.randomUUID();
        const inputHash = crypto.createHash('sha256').update(item.payloadJson).digest('hex');

        // Log Agent Run START
        const agentRun = await prisma.agentRun.create({
            data: {
                id: runId,
                organizationId: orgId,
                agentName,
                status: "running",
                inputHash,
                inputJson: item.payloadJson,
                relatedEntityType: item.relatedEntityType,
                relatedEntityId: item.relatedEntityId
            }
        });

        try {
            const result = await agent.run(JSON.parse(item.payloadJson), { orgId, userId: approvedByUserId });

            // Agent Run END
            await prisma.agentRun.update({
                where: { id: runId },
                data: {
                    status: result.success ? "succeeded" : "failed",
                    outputJson: result.data ? JSON.stringify(result.data) : null,
                    costUsd: result.costUsd || 0,
                    tokensIn: result.tokensIn || 0,
                    tokensOut: result.tokensOut || 0,
                    errorMessage: result.error,
                    finishedAt: new Date()
                }
            });

            if (result.success) {
                await prisma.actionQueue.update({
                    where: { id: queueId },
                    data: { status: "executed", executedAt: new Date(), lockedByRunId: null, lockedUntil: null }
                });
                await prisma.auditEvent.create({
                    data: { organizationId: orgId, action: "executed", assessmentId: item.relatedEntityId || "none" }
                });
            } else {
                await this.markItemRejected(queueId, `Agent run failed: ${result.error}`);
            }

        } catch (err: any) {
            await prisma.agentRun.update({
                where: { id: runId },
                data: {
                    status: "failed",
                    errorMessage: err.message,
                    finishedAt: new Date()
                }
            });
            await this.markItemRejected(queueId, `Agent Exception: ${err.message}`);
        }
    }

    private static mapTypeToAgent(type: string): string {
        switch (type) {
            case "start_sequence":
            case "send_whatsapp":
                return "FunnelAgent";
            case "publish_content":
                return "ContentAgent";
            case "generate_proposal":
                return "ProposalAgent";
            case "generate_presales":
                return "PreSalesAgent";
            // V17 P2: Strategy actions
            case "critical_owner_ping":
            case "proposal_followup":
            case "nurture_sequence":
                return "StrategyAgent";
            // V17 P3: Auto-draft + send scheduling
            case "generate_proposal_draft":
            case "send_proposal_scheduled":
                return "ProposalDraftAgent";
            // V18: Onboarding autopilot
            case "onboarding_pack_send":
            case "kickoff_schedule_prompt":
            case "remind_onboarding_48h":
                return "OnboardingAgent";
            case "memory_reindex_org":
                return "MemoryAgent";
            default:
                return "OpsAgent";
        }
    }

    private static async markItemRejected(id: string, reason: string) {
        const item = await prisma.actionQueue.update({
            where: { id },
            data: { status: "rejected", reason, lockedByRunId: null, lockedUntil: null }
        });
        await prisma.auditEvent.create({
            data: { organizationId: item.organizationId, action: "rejected", details: reason, assessmentId: item.relatedEntityId || "none" }
        });
    }

    // ─── V17: Brain Cycle ────────────────────────────────────────────────────

    /**
     * BrainCycle: For each active MeetingSession, recalibrates probability,
     * updates expectedRevenue, runs the strategy engine, persists output fields on
     * the session, upserts ActionQueue items from nextActions, and triggers
     * auto-proposal-draft generation within the ideal timing window.
     * Should be called periodically (e.g., cron every 15 min).
     */
    static async brainCycle(orgId: string): Promise<void> {
        const activeSessions = await (prisma as any).meetingSession.findMany({
            where: {
                organizationId: orgId,
                status: { not: "canceled" },
            },
        });

        // Derive top-20% revenue threshold across active pipeline
        const revenueValues: number[] = activeSessions
            .map((s: any) => s.expectedRevenue as number | null)
            .filter((v: number | null): v is number => v != null)
            .sort((a: number, b: number) => a - b);
        const top20Threshold = revenueValues.length > 0
            ? revenueValues[Math.floor(revenueValues.length * 0.8)] ?? 0
            : 0;

        for (const session of activeSessions) {
            try {
                // 1. Recalibrate probability
                const calibration = await calibrateCloseProbability(session.id);

                // 2. Update expectedRevenue + ActionQueue priority
                const revenueResult = await calculateExpectedRevenue(session.id);

                // 3. Check timing escalation rules (legacy — V16 proposals)
                await shouldEscalateProposal(session.id);

                // 4. Strategy decision (V17 P2)
                const freshSession = await (prisma as any).meetingSession.findUnique({
                    where: { id: session.id },
                });
                if (!freshSession) continue;

                const now = new Date();
                const minutesSinceMeetingEnd = freshSession.endAt
                    ? Math.max(0, Math.round((now.getTime() - new Date(freshSession.endAt).getTime()) / 60000))
                    : 0;

                const daysSinceProposalSent = freshSession.updatedAt
                    ? Math.round((now.getTime() - new Date(freshSession.updatedAt).getTime()) / 86400000)
                    : 0;

                const isTop20 = (freshSession.expectedRevenue ?? 0) >= top20Threshold && top20Threshold > 0;

                const strategyInput: StrategyInput = {
                    adjustedProbability: calibration.adjustedProbability,
                    expectedRevenue: revenueResult.expectedRevenue,
                    tier: (freshSession.priorityTier ?? "warm") as "hot" | "warm" | "cold",
                    hasProposal: false,  // refined below
                    proposalStatus: "none",
                    minutesSinceMeetingEnd,
                    daysSinceProposalSent,
                    source: "manual",
                    pipelineQualityIndex: calibration.confidenceScore,
                    isTop20PercentRevenue: isTop20,
                };

                // Refine hasProposal / proposalStatus from linked assessment
                if (freshSession.assessmentId) {
                    const latestProposal = await (prisma as any).proposal.findFirst({
                        where: { assessmentId: freshSession.assessmentId },
                        orderBy: { createdAt: "desc" },
                        select: { status: true },
                    });
                    if (latestProposal) {
                        strategyInput.hasProposal = true;
                        strategyInput.proposalStatus = latestProposal.status as StrategyInput["proposalStatus"];
                    }
                }

                const strategyResult = decideStrategy(strategyInput);

                // 5. Persist strategy fields on MeetingSession
                await (prisma as any).meetingSession.update({
                    where: { id: session.id },
                    data: {
                        followUpTone: strategyResult.followUpTone,
                        urgencyLevel: strategyResult.urgencyLevel,
                        proposalStructure: strategyResult.proposalStructure,
                        recommendedCTA: strategyResult.recommendedCTA,
                    },
                });

                // 6. Upsert ActionQueue items from nextActions
                for (const action of strategyResult.nextActions) {
                    await this.upsertStrategyAction({
                        orgId,
                        sessionId: session.id,
                        type: action.type,
                        priorityDelta: action.priorityDelta,
                        dueInMinutes: action.dueInMinutes,
                        reason: action.reason,
                        payloadJson: { meetingSessionId: session.id, orgId },
                    });
                }

                // 7. Auto-proposal draft trigger (V17 P3)
                const prob = calibration.adjustedProbability;
                const inWindow = minutesSinceMeetingEnd >= 20 && minutesSinceMeetingEnd <= 240;
                const meetsThreshold = prob >= 0.60;
                const isTop40 = revenueResult.priorityWeight >= 60; // top 40% = weight >= 60

                if (freshSession.status === "completed" && inWindow && meetsThreshold && isTop40) {
                    await this.upsertStrategyAction({
                        orgId,
                        sessionId: session.id,
                        type: "generate_proposal_draft",
                        priorityDelta: prob >= 0.75 ? 50 : 35, // critical for prob >= 0.75
                        dueInMinutes: 0,
                        reason: "Auto-draft: timing ideal pós-reunião",
                        payloadJson: {
                            meetingSessionId: session.id,
                            orgId,
                            highPriority: prob >= 0.75,
                        },
                    });
                }

            } catch (err: any) {
                // Partial failures should not abort the full cycle
                console.error(`[BrainCycle] Error processing session ${session.id}:`, err.message);
            }
        }
    }

    /**
     * Upsert an ActionQueue item by (orgId, type, relatedEntityId).
     * If a pending item already exists it increments the weight via priority label;
     * otherwise creates a new item.
     * dueAt = now + dueInMinutes minutes.
     */
    private static async upsertStrategyAction(opts: {
        orgId: string;
        sessionId: string;
        type: string;
        priorityDelta: number;
        dueInMinutes?: number;
        reason: string;
        payloadJson: object;
    }): Promise<void> {
        const { orgId, sessionId, type, priorityDelta, dueInMinutes, reason, payloadJson } = opts;

        const dueAt = dueInMinutes != null && dueInMinutes > 0
            ? new Date(Date.now() + dueInMinutes * 60000)
            : null;

        // Check for existing pending item
        const existing = await (prisma as any).actionQueue.findFirst({
            where: {
                organizationId: orgId,
                type,
                relatedEntityType: "meeting_session",
                relatedEntityId: sessionId,
                status: "pending",
            },
        });

        const newPriority = this.deltaToPriorityLabel(priorityDelta);

        if (existing) {
            // Escalate priority if the new label is higher
            const currentRank = ["critical", "high", "medium", "low"].indexOf(existing.priority);
            const newRank = ["critical", "high", "medium", "low"].indexOf(newPriority);
            if (newRank < currentRank) {
                await (prisma as any).actionQueue.update({
                    where: { id: existing.id },
                    data: { priority: newPriority, ...(dueAt ? { nextRetryAt: dueAt } : {}) },
                });
            }
            return;
        }

        // Create new item
        await (prisma as any).actionQueue.create({
            data: {
                organizationId: orgId,
                type,
                payloadJson: JSON.stringify(payloadJson),
                priority: newPriority,
                relatedEntityType: "meeting_session",
                relatedEntityId: sessionId,
                status: "pending",
                approvalRequired: false,
                reason,
                ...(dueAt ? { nextRetryAt: dueAt } : {}),
            },
        });
    }

    /** Map a priorityDelta integer to an ActionQueue priority label */
    private static deltaToPriorityLabel(delta: number): string {
        if (delta >= 40) return "critical";
        if (delta >= 25) return "high";
        if (delta >= 10) return "medium";
        return "low";
    }

    /**
     * run-due: Execute pending queue items ordered by priorityWeight DESC.
     * Priority labels map: critical > high > medium > low.
     */
    static async runDue(orgId: string): Promise<void> {
        const PRIORITY_ORDER = ["critical", "high", "medium", "low"];

        // Fetch pending items sorted by priority label (DB level) and creation date
        const pendingItems = await (prisma as any).actionQueue.findMany({
            where: {
                organizationId: orgId,
                status: "pending",
                OR: [
                    { lockedUntil: null },
                    { lockedUntil: { lt: new Date() } },
                ],
            },
            orderBy: [
                { priority: "asc" }, // critical < high alphabetically — see sort below
                { createdAt: "asc" },
            ],
            select: { id: true, priority: true },
        });

        // Sort in JS by our priority enum order
        const sorted = pendingItems.sort((a: any, b: any) => {
            const ai = PRIORITY_ORDER.indexOf(a.priority);
            const bi = PRIORITY_ORDER.indexOf(b.priority);
            return ai - bi;
        });

        for (const item of sorted) {
            await this.executeAction(item.id, orgId);
        }
    }
}
