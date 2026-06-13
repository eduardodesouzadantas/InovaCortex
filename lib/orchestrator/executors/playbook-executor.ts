import { runPlaybook } from "@/lib/playbooks/executor";
import { prisma } from "@/lib/prisma";
import { createSystemEvent } from "@/lib/system-events";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { AgentImplementation, OrchestratorContext } from "../types";
import { PlaybookContext } from "@/lib/playbooks/registry";

export const PlaybookAgent: AgentImplementation = {
    name: "PlaybookAgent",
    async run(input: any, ctx: OrchestratorContext) {
        const { actionType, payloadJson, organizationId } = input;
        const payload = input; // If input is already the parsed JSON

        // Create realistic runtime context
        const runCtx: PlaybookContext = {
            db: prisma as any,
            orgId: ctx.orgId,
            whatsapp: {
                hasOptIn: async () => true, // Assume true for now (or wire to Assessment/Sequence config later)
                isInside24hWindow: async () => true, // Mocked 24h window
                isApprovedTemplate: async () => true,
            },
            limits: {
                countOrgActionsToday: async () => 0,
                countContactActionsToday: async () => 0,
                lastOrgActionAt: async () => null,
            },
            time: {
                todayKey: (orgId) => `${orgId}-${new Date().toISOString().split("T")[0]}`,
                withinOrgSafeHours: async () => true,
                hoursSince: () => 0,
            },
            targets: {
                proposalsViewedTwiceNoReply48h: async () => [],
                meetingMissedLast7d: async () => [],
                whatsAppOpenWithSlaDue: async () => [],
                hotWarmNoActivity72h: async () => [],
                ceoWhatsappThread: async () => [],
            },
            copy: {
                generateTwoFollowupsFromEvidence: async () => ({
                    selectedText: "Fallback text option 1",
                    previewText: "Fallback text option 2",
                }),
            },
            briefing: {
                buildDailyCEO: async () => "Simulated CEO Briefing Text",
            },
        };

        try {
            if (input.type === "playbook_run") {
                await runPlaybook(runCtx, {
                    playbookId: payload.playbookId,
                    orgId: ctx.orgId,
                    actorUserId: payload.actorUserId ?? null,
                    dryRun: !!payload.dryRun,
                    inputJson: payload.inputJson ?? null,
                    resumeRunId: payload.resumeRunId ?? undefined,
                });
                return { success: true };
            }

            if (input.type === "playbook_step") {
                const { runId, playbookId, target, step } = payload;

                if (step.channel === "whatsapp") {
                    if (step.actionType === "wa_send_text") {
                        await sendWhatsAppMessage(step.payload.conversationId, step.payload.text);
                    }
                    if (step.actionType === "wa_send_template") {
                        await sendWhatsAppTemplate(step.payload.conversationId, step.payload.templateKey, "pt_BR", step.payload.params);
                    }
                }

                // Idempotency log
                await createSystemEvent({
                    organizationId: ctx.orgId,
                    type: "playbook_action_sent",
                    severity: "info",
                    entityType: "playbook_run",
                    entityId: runId,
                    payloadJson: JSON.stringify({ playbookId, runId, targetId: target.targetId, stepKey: step.stepKey }),
                    dedupeKey: step.actionHash,
                });

                // Audit Trail
                await prisma.auditEvent.create({
                    data: {
                        organizationId: ctx.orgId,
                        action: "playbook_step_executed",
                        assessmentId: "none",
                        details: JSON.stringify({ playbookId, runId, targetId: target.targetId, stepKey: step.stepKey }),
                    },
                });

                return { success: true };
            }

            return { success: false, error: `Unknown playbook job type: ${input.type}` };
        } catch (err: any) {
            return { success: false, error: String(err?.message ?? err) };
        }
    },
};
