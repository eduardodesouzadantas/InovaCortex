import { PrismaClient } from "@prisma/client";

export type PlaybookId =
    | "pb_hot_proposal_followup"
    | "pb_no_show_recovery"
    | "pb_sla_breach_escalation"
    | "pb_lead_stalled_rescue"
    | "pb_daily_ceo_action_pack";

export type PlaybookTarget = {
    targetId: string;           // stable id (proposalId, conversationId, leadId, etc)
    contactId?: string;
    waConversationId?: string;
    leadId?: string;
    assessmentId?: string;
    proposalId?: string;
    repUserId?: string;
    evidence?: any;
};

export type StepPlan = {
    stepKey: string;            // "wa_send_template", "assign_rep", etc
    channel: "whatsapp" | "internal";
    actionType: string;         // "wa_send_template" | "wa_send_text" | "assign_rep" | "notify_manager" | "reassign_conversation"
    payload: any;
    actionHash: string;
    requiresApproval: boolean;
};

export type PlaybookContext = {
    db: PrismaClient;
    orgId: string;
    // External service adapters injected during execution
    whatsapp: {
        hasOptIn: (contactId?: string) => Promise<boolean>;
        isInside24hWindow: (waConversationId?: string) => Promise<boolean>;
        isApprovedTemplate: (templateKey: string) => Promise<boolean>;
    };
    limits: {
        countOrgActionsToday: (orgId: string) => Promise<number>;
        countContactActionsToday: (orgId: string, contactId: string) => Promise<number>;
        lastOrgActionAt: (orgId: string) => Promise<Date | null>;
    };
    time: {
        todayKey: (orgId: string) => string;
        withinOrgSafeHours: (orgId: string, safeHours?: { start: string; end: string }) => Promise<boolean>;
        hoursSince: (date: Date) => number;
    };
    targets: {
        proposalsViewedTwiceNoReply48h: () => Promise<PlaybookTarget[]>;
        meetingMissedLast7d: () => Promise<PlaybookTarget[]>;
        whatsAppOpenWithSlaDue: () => Promise<PlaybookTarget[]>;
        hotWarmNoActivity72h: () => Promise<PlaybookTarget[]>;
        ceoWhatsappThread: () => Promise<PlaybookTarget[]>;
    };
    copy: {
        generateTwoFollowupsFromEvidence: (target: PlaybookTarget) => Promise<{ selectedText: string; previewText: string }>;
    };
    briefing: {
        buildDailyCEO: () => Promise<string>;
    };
};

export type PlaybookDefinition = {
    id: PlaybookId;
    name: string;
    description: string;
    defaultApprovalMode: "auto" | "requires_admin" | "requires_owner";
    defaultPolicy: any;
    resolveTargets: (ctx: PlaybookContext) => Promise<PlaybookTarget[]>;
    buildSteps: (ctx: PlaybookContext, target: PlaybookTarget) => Promise<Omit<StepPlan, "actionHash">[]>;
};

export const PLAYBOOKS: Record<PlaybookId, PlaybookDefinition> = {
    pb_hot_proposal_followup: {
        id: "pb_hot_proposal_followup",
        name: "Hot Proposal Follow-up",
        description: "Propostas vistas >=2 sem resposta há 48h.",
        defaultApprovalMode: "auto",
        defaultPolicy: {
            maxActionsPerDay: 200,
            maxPerContactPerDay: 1,
            maxTargetsPerRun: 50,
            maxStepsPerRun: 150,
            safeHours: { start: "08:00", end: "20:00" }
        },
        resolveTargets: async (ctx) => ctx.targets.proposalsViewedTwiceNoReply48h(),
        buildSteps: async (ctx, t) => {
            const inside24h = await ctx.whatsapp.isInside24hWindow(t.waConversationId);
            if (!inside24h) {
                return [{
                    stepKey: "wa_followup_template",
                    channel: "whatsapp",
                    actionType: "wa_send_template",
                    payload: { conversationId: t.waConversationId, templateKey: "HOT_PROPOSAL_FOLLOWUP", params: {} },
                    requiresApproval: false,
                }];
            }
            return [{
                stepKey: "wa_followup_text",
                channel: "whatsapp",
                actionType: "wa_send_text",
                payload: { conversationId: t.waConversationId, text: "Oi! Vi que você abriu a proposta algumas vezes. Que tal darmos o próximo passo? Tem alguma dúvida?" },
                requiresApproval: false,
            }];
        },
    },

    pb_no_show_recovery: {
        id: "pb_no_show_recovery",
        name: "No-Show Recovery",
        description: "Recupera no-show dos últimos 7 dias.",
        defaultApprovalMode: "auto",
        defaultPolicy: {
            maxActionsPerDay: 200,
            maxPerContactPerDay: 1,
            maxTargetsPerRun: 50,
            maxStepsPerRun: 100,
            safeHours: { start: "08:00", end: "20:00" }
        },
        resolveTargets: async (ctx) => ctx.targets.meetingMissedLast7d(),
        buildSteps: async (ctx, t) => ([
            {
                stepKey: "wa_no_show_template",
                channel: "whatsapp",
                actionType: "wa_send_template",
                payload: { conversationId: t.waConversationId, templateKey: "NO_SHOW_RECOVERY", params: {} },
                requiresApproval: false,
            },
            {
                stepKey: "assign_rep",
                channel: "internal",
                actionType: "assign_rep",
                payload: { leadId: t.leadId, strategy: "round_robin_or_owner" },
                requiresApproval: false,
            },
        ]),
    },

    pb_sla_breach_escalation: {
        id: "pb_sla_breach_escalation",
        name: "SLA Breach Escalation",
        description: "Conversa aberta com SLA vencido.",
        defaultApprovalMode: "auto",
        defaultPolicy: {
            maxActionsPerDay: 500,
            maxPerContactPerDay: 3,
            maxTargetsPerRun: 50,
            maxStepsPerRun: 100,
            safeHours: { start: "00:00", end: "23:59" }
        },
        resolveTargets: async (ctx) => ctx.targets.whatsAppOpenWithSlaDue(),
        buildSteps: async (ctx, t) => ([
            {
                stepKey: "notify_manager",
                channel: "internal",
                actionType: "notify_manager",
                payload: { conversationId: t.waConversationId, reason: "SLA_BREACH" },
                requiresApproval: false,
            },
            {
                stepKey: "reassign_conversation",
                channel: "internal",
                actionType: "reassign_conversation",
                payload: { conversationId: t.waConversationId, policy: "assignment_engine" },
                requiresApproval: false,
            },
        ]),
    },

    pb_lead_stalled_rescue: {
        id: "pb_lead_stalled_rescue",
        name: "Lead Stalled 72h Rescue",
        description: "Leads hot/warm sem eventos 72h.",
        defaultApprovalMode: "requires_admin",
        defaultPolicy: {
            maxActionsPerDay: 100,
            maxPerContactPerDay: 1,
            maxTargetsPerRun: 20,
            maxStepsPerRun: 20,
            safeHours: { start: "08:00", end: "20:00" }
        },
        resolveTargets: async (ctx) => ctx.targets.hotWarmNoActivity72h(),
        buildSteps: async (ctx, t) => {
            const options = await ctx.copy.generateTwoFollowupsFromEvidence(t);
            return [{
                stepKey: "wa_rescue_options",
                channel: "whatsapp",
                actionType: "wa_send_text",
                payload: { conversationId: t.waConversationId, text: options.selectedText, meta: { options } },
                requiresApproval: true,
            }];
        },
    },

    pb_daily_ceo_action_pack: {
        id: "pb_daily_ceo_action_pack",
        name: "Daily CEO Action Pack",
        description: "Briefing diário para o CEO do que está pendente no Run Due.",
        defaultApprovalMode: "auto",
        defaultPolicy: {
            maxActionsPerDay: 5,
            maxPerContactPerDay: 5,
            maxTargetsPerRun: 1,
            maxStepsPerRun: 1,
            safeHours: { start: "08:00", end: "20:00" }
        },
        resolveTargets: async (ctx) => ctx.targets.ceoWhatsappThread(),
        buildSteps: async (ctx, t) => ([
            {
                stepKey: "wa_ceo_briefing",
                channel: "whatsapp",
                actionType: "wa_send_text",
                payload: { conversationId: t.waConversationId, text: await ctx.briefing.buildDailyCEO() },
                requiresApproval: false,
            },
        ]),
    },
};
