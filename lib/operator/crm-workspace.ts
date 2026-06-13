import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { assertRole, type Role } from "@/lib/auth/rbac";
import { ensureAssessmentCommercialFlow } from "@/lib/commercial/canonical-flow";
import { buildTenantRevenueSignals, type TenantRevenueSignals } from "@/lib/commercial/revenue-engine";
import {
    buildMessageSnapshot,
    resolveWhatsAppConversationAttention,
    resolveWhatsAppMessageLifecycleLabel,
} from "@/lib/whatsapp/crm-service";

type CrmTone = "neutral" | "positive" | "warning" | "critical";
type CrmColumnKind = "text" | "status" | "lifecycle" | "stage" | "metric";
type CrmViewMode = "table" | "board";
export type CrmViewId = "all" | "follow-up" | "stalled-proposals" | "quiet-window" | "meetings" | "pipeline" | "revenue-risk" | "proposals";
export type CrmFieldValueType = "text" | "select" | "datetime" | "number" | "boolean" | "currency";
export type CrmDetailEditorSection = "workflow" | "qualification" | "niche";
export type CrmViewScope = "user" | "tenant";
export type CrmViewSortId = "priority-desc" | "last-touch-desc" | "last-touch-asc" | "next-meeting-asc" | "company-asc";
export type CrmCadenceId = "initial-follow-up" | "silent-reactivation" | "proposal-revival" | "meeting-prep" | "opportunity-advance";
export type CrmPlaybookId =
    | "follow-up-initial"
    | "reactivate-silent-lead"
    | "revive-stalled-proposal"
    | "prepare-meeting"
    | "confirm-meeting"
    | "log-meeting-result"
    | "advance-opportunity"
    | "advance-active-cadence"
    | "resume-negotiation"
    | "log-loss"
    | "schedule-new-conversation";
type ControlledNicheEditableFieldId =
    | "appointmentWindow"
    | "procedureType"
    | "insuranceType"
    | "propertyInterest"
    | "propertyType"
    | "budgetRange"
    | "legalArea"
    | "caseType"
    | "caseUrgency";

export type CrmEditableField =
    | "assessment.status"
    | "assessment.segment"
    | "assessment.urgency"
    | "assessment.goal"
    | "contact.lifecycle"
    | "deal.stageId"
    | "conversation.assignedUserId"
    | "workspace.priority"
    | "workspace.nextAction"
    | "workspace.nextActionAt"
    | "workspace.lostReason"
    | "proposal.status"
    | `workspace.niche.${ControlledNicheEditableFieldId}`;

export type CrmBulkEditableField =
    | "assessment.status"
    | "contact.lifecycle"
    | "deal.stageId"
    | "conversation.assignedUserId"
    | "workspace.priority"
    | "workspace.nextAction"
    | "workspace.nextActionAt"
    | "workspace.lostReason"
    | "proposal.status";

export interface CrmFieldOption {
    value: string;
    label: string;
}

export interface CrmSortOption {
    id: CrmViewSortId;
    label: string;
    description: string;
}

export interface CrmCadenceTemplate {
    id: CrmCadenceId;
    label: string;
    description: string;
    stepOffsetsDays: number[];
}

export interface CrmPlaybookDefinition {
    id: CrmPlaybookId;
    label: string;
    description: string;
    viewIds: CrmViewId[];
    cadenceId?: CrmCadenceId;
    defaultPriority?: string;
    actionLabel: string;
}

export interface CrmRecommendedAction {
    id: string;
    title: string;
    reason: string;
    playbookId: CrmPlaybookId;
    actionLabel: string;
}

export interface CrmWorkspaceColumn {
    id: string;
    label: string;
    kind: CrmColumnKind;
    valueType: CrmFieldValueType;
    options?: CrmFieldOption[];
    viewIds: CrmViewId[];
    editableField?: CrmEditableField;
}

export interface CrmDetailEditorDefinition {
    id: string;
    field: CrmEditableField;
    columnId: string;
    label: string;
    valueType: CrmFieldValueType;
    options?: CrmFieldOption[];
    section: CrmDetailEditorSection;
}

export interface CrmWorkspaceViewPreset {
    id: string;
    kind: "system" | "saved";
    baseViewId: CrmViewId;
    label: string;
    description: string;
    columnIds: string[];
    defaultMode: CrmViewMode;
    sortId: CrmViewSortId;
    scope?: CrmViewScope;
    createdAt?: string;
}

export interface CrmWorkspaceMetric {
    id: string;
    label: string;
    value: string;
    detail: string;
    tone: CrmTone;
}

export interface CrmWorkspaceRecord {
    id: string;
    company: string;
    primaryContact: string;
    email: string;
    phone: string;
    status: string;
    contactLifecycle: string;
    dealStageId: string | null;
    dealStageLabel: string;
    proposalStatus: string;
    proposalLabel: string;
    scoreLabel: string;
    lastTouchAt: string;
    lastTouchLabel: string;
    nextMeetingLabel: string;
    unreadCount: number;
    activityCount: number;
    tags: string[];
    tone: CrmTone;
    boardColumnId: string;
    boardColumnByView: Partial<Record<CrmViewId, string>>;
    conversationId: string | null;
    ownerUserId: string | null;
    ownerLabel: string;
    priority: string;
    nextAction: string;
    nextActionAt: string | null;
    nextActionAtLabel: string;
    cadenceLabel: string;
    recommendedActionLabel: string;
    needsAttention: boolean;
    hasDeal: boolean;
    hasConversation: boolean;
    viewIds: CrmViewId[];
    extensionValues: Record<string, string>;
}

export interface CrmBoardColumn {
    id: string;
    label: string;
    description: string;
    tone: CrmTone;
}

export interface CrmBulkActionDefinition {
    id: string;
    field: CrmBulkEditableField;
    label: string;
    description: string;
    valueType: CrmFieldValueType;
    options?: CrmFieldOption[];
    placeholder?: string;
}

export interface CrmWorkflowShortcut {
    id: string;
    label: string;
    description: string;
    field: CrmBulkEditableField;
    suggestedValue: string;
}

export interface CrmNicheSectionSchema {
    id: string;
    title: string;
    description: string;
    fieldIds: string[];
}

export interface OperatorCrmWorkspaceModel {
    generatedAt: string;
    orgSlug: string;
    orgName: string;
    industry: string;
    summary: {
        headline: string;
        subheadline: string;
        metrics: CrmWorkspaceMetric[];
        focus: string[];
    };
    niche: {
        key: string;
        label: string;
        description: string;
        tableFieldIds: string[];
        editableFieldIds: string[];
        detailSections: CrmNicheSectionSchema[];
    };
    table: {
        columns: CrmWorkspaceColumn[];
        records: CrmWorkspaceRecord[];
    };
    views: {
        defaultViewId: string;
        presets: CrmWorkspaceViewPreset[];
        saved: CrmWorkspaceViewPreset[];
        system: CrmWorkspaceViewPreset[];
        sortOptions: CrmSortOption[];
        saveScopes: Array<{ value: CrmViewScope; label: string }>;
    };
    board: {
        columns: CrmBoardColumn[];
        columnsByView: Record<CrmViewId, CrmBoardColumn[]>;
    };
    editable: {
        assessmentStatus: CrmFieldOption[];
        contactLifecycle: CrmFieldOption[];
        dealStage: CrmFieldOption[];
        owner: CrmFieldOption[];
        priority: CrmFieldOption[];
        detailEditors: CrmDetailEditorDefinition[];
        bulkActions: CrmBulkActionDefinition[];
    };
    shortcuts: {
        byView: Record<CrmViewId, CrmWorkflowShortcut[]>;
        selectionLimit: number;
    };
    automation: {
        cadenceTemplates: CrmCadenceTemplate[];
        playbooksByView: Record<CrmViewId, CrmPlaybookDefinition[]>;
    };
    filters: {
        quick: Array<{ id: string; label: string; description: string }>;
    };
    warnings: string[];
}

export interface CrmRecordDetailSection {
    id: string;
    title: string;
    description: string;
    items: Array<{ id: string; label: string; value: string; tone?: CrmTone }>;
}

export interface CrmRecordTimelineItem {
    id: string;
    title: string;
    detail: string;
    eyebrow: string;
    at: string;
    tone: CrmTone;
}

export interface CrmRecordMessageItem {
    id: string;
    direction: "inbound" | "outbound";
    text: string;
    status: string;
    at: string;
}

export interface CrmRecordLiveTimelineItem extends CrmRecordTimelineItem {
    kind: "message" | "activity" | "proposal" | "meeting";
}

export interface CrmRecordConversationContext {
    label: string;
    detail: string;
    tone: CrmTone;
    statusLabel: string;
    unreadLabel: string;
    lastMessagePreview: string;
    lastMessageAtLabel: string;
    slaLabel: string;
    assignmentLabel: string;
}

export interface CrmRecordOperationalSummary {
    lastInteractionLabel: string;
    pendingLabel: string;
    nextBestActionLabel: string;
}

export interface CrmRecordQuickAction {
    id: string;
    label: string;
    description: string;
    tone: CrmTone;
    kind: "link" | "playbook" | "inline-update";
    href?: string;
    playbookId?: CrmPlaybookId;
    field?: CrmEditableField;
    value?: string;
}

export interface CrmRecordDetailModel {
    id: string;
    company: string;
    primaryContact: string;
    subtitle: string;
    segment: string;
    urgency: string;
    goal: string;
    status: string;
    contactLifecycle: string;
    dealStageLabel: string;
    dealStageId: string | null;
    conversationId: string | null;
    ownerUserId: string | null;
    ownerLabel: string;
    priority: string;
    nextAction: string;
    nextActionAt: string | null;
    nextActionAtLabel: string;
    cadenceLabel: string;
    nicheValues: Record<string, string>;
    editableValues: Record<string, string>;
    recommendations: CrmRecommendedAction[];
    conversation: CrmRecordConversationContext | null;
    operationalSummary: CrmRecordOperationalSummary;
    badges: Array<{ id: string; label: string; tone: CrmTone }>;
    quickActions: CrmRecordQuickAction[];
    quickLinks: Array<{ id: string; label: string; href: string }>;
    overview: CrmRecordDetailSection;
    nicheSections: CrmRecordDetailSection[];
    timeline: CrmRecordLiveTimelineItem[];
    proposals: CrmRecordTimelineItem[];
    activities: CrmRecordTimelineItem[];
    agenda: CrmRecordTimelineItem[];
    messages: CrmRecordMessageItem[];
}

export interface UpdateCrmInlineFieldInput {
    organizationId: string;
    role: Role | string;
    assessmentId: string;
    field: CrmEditableField;
    value: string;
}

export interface UpdateCrmInlineFieldResult {
    assessmentId: string;
    field: CrmEditableField;
    value: string;
    conversationId: string | null;
}

export interface SaveCrmSavedViewInput {
    organizationId: string;
    userId: string;
    role: Role | string;
    name: string;
    scope: CrmViewScope;
    baseViewId: CrmViewId;
    defaultMode: CrmViewMode;
    sortId: CrmViewSortId;
    columnIds: string[];
}

export interface SaveCrmSavedViewResult {
    view: CrmWorkspaceViewPreset;
}

export interface ExecuteCrmBulkActionInput {
    organizationId: string;
    role: Role | string;
    assessmentIds: string[];
    field: CrmBulkEditableField;
    value: string;
}

export interface ExecuteCrmBulkActionResult {
    field: CrmBulkEditableField;
    value: string;
    totalRequested: number;
    successCount: number;
    failureCount: number;
    results: Array<{
        assessmentId: string;
        success: boolean;
        result?: UpdateCrmInlineFieldResult;
        error?: string;
    }>;
}

export interface ExecuteCrmPlaybookInput {
    organizationId: string;
    role: Role | string;
    assessmentIds: string[];
    playbookId: CrmPlaybookId;
    sourceViewId?: CrmViewId | null;
}

export interface ExecuteCrmPlaybookResult {
    playbookId: CrmPlaybookId;
    totalRequested: number;
    successCount: number;
    failureCount: number;
    results: Array<{
        assessmentId: string;
        success: boolean;
        cadenceLabel?: string;
        error?: string;
    }>;
}

export interface OperatorCrmWorkspaceInput {
    orgSlug: string;
    orgName: string;
    industry: string;
    records: CrmWorkspaceRecord[];
    stageOptions: CrmFieldOption[];
    ownerOptions: CrmFieldOption[];
    savedViews?: CrmWorkspaceViewPreset[];
    revenueSignals?: TenantRevenueSignals;
}

const ASSESSMENT_STATUS_OPTIONS: CrmFieldOption[] = [
    { value: "Novo", label: "Novo" },
    { value: "Qualificado", label: "Qualificado" },
    { value: "Contatado", label: "Contatado" },
    { value: "Agendado", label: "Agendado" },
    { value: "Proposta", label: "Proposta" },
    { value: "Fechado", label: "Fechado" },
    { value: "Perdido", label: "Perdido" },
];

const CONTACT_LIFECYCLE_OPTIONS: CrmFieldOption[] = [
    { value: "lead", label: "Lead" },
    { value: "qualified", label: "Qualified" },
    { value: "opportunity", label: "Opportunity" },
    { value: "client", label: "Client" },
    { value: "inactive", label: "Inactive" },
];

const PRIORITY_OPTIONS: CrmFieldOption[] = [
    { value: "low", label: "Baixa" },
    { value: "medium", label: "Media" },
    { value: "high", label: "Alta" },
    { value: "critical", label: "Critica" },
];

const PROPOSAL_STATUS_OPTIONS: CrmFieldOption[] = [
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "viewed", label: "Viewed" },
    { value: "stalled", label: "Stalled" },
    { value: "won", label: "Won" },
    { value: "lost", label: "Lost" },
    { value: "accepted", label: "Accepted" },
    { value: "rejected", label: "Rejected" },
    { value: "none", label: "Sem proposta" },
];

const LOSS_REASON_OPTIONS: CrmFieldOption[] = [
    { value: "price", label: "Preço" },
    { value: "no-response", label: "Falta de resposta" },
    { value: "timing", label: "Timing" },
    { value: "unfit-proposal", label: "Proposta inadequada" },
    { value: "no-priority", label: "Sem prioridade" },
    { value: "competition", label: "Concorrência" },
    { value: "other", label: "Outro / Desconhecido" },
];

const CRM_VIEW_SORT_OPTIONS: CrmSortOption[] = [
    { id: "priority-desc", label: "Prioridade", description: "Critical e high primeiro." },
    { id: "last-touch-desc", label: "Toque recente", description: "Ultimas interacoes no topo." },
    { id: "last-touch-asc", label: "Sem toque ha mais tempo", description: "Fila de reativacao primeiro." },
    { id: "next-meeting-asc", label: "Agenda mais proxima", description: "Compromissos mais proximos no topo." },
    { id: "company-asc", label: "Conta A-Z", description: "Leitura alfabetica da carteira." },
];

const CRM_SAVE_SCOPE_OPTIONS: Array<{ value: CrmViewScope; label: string }> = [
    { value: "user", label: "Minha view" },
    { value: "tenant", label: "View do tenant" },
];

const CRM_BULK_ACTION_LIMIT = 25;
const CRM_SAVED_VIEWS_KEY_PREFIX = "crm.workspace.savedViews";
const CRM_PLAYBOOK_ACTION_LIMIT = 25;

const BASE_EDITABLE_FIELDS = [
    "assessment.status",
    "assessment.segment",
    "assessment.urgency",
    "assessment.goal",
    "contact.lifecycle",
    "deal.stageId",
    "conversation.assignedUserId",
    "workspace.priority",
    "workspace.nextAction",
    "workspace.nextActionAt",
    "proposal.status",
] as const;

const CONTROLLED_NICHE_EDITABLE_FIELD_IDS = [
    "appointmentWindow",
    "procedureType",
    "insuranceType",
    "propertyInterest",
    "propertyType",
    "budgetRange",
    "legalArea",
    "caseType",
    "caseUrgency",
] as const satisfies readonly ControlledNicheEditableFieldId[];

const CRM_EDITABLE_FIELDS = [
    ...BASE_EDITABLE_FIELDS,
    ...CONTROLLED_NICHE_EDITABLE_FIELD_IDS.map((fieldId) => `workspace.niche.${fieldId}` as const),
] as const;

const CRM_BULK_EDITABLE_FIELDS = [
    "assessment.status",
    "contact.lifecycle",
    "deal.stageId",
    "conversation.assignedUserId",
    "workspace.priority",
    "workspace.nextAction",
    "workspace.nextActionAt",
    "workspace.lostReason",
    "proposal.status",
] as const satisfies readonly CrmBulkEditableField[];

const CRM_CADENCE_TEMPLATES: CrmCadenceTemplate[] = [
    { id: "initial-follow-up", label: "Cadencia de follow-up inicial", description: "Tres toques curtos para qualificacao inicial.", stepOffsetsDays: [1, 3, 5] },
    { id: "silent-reactivation", label: "Cadencia de reativacao", description: "Retomada progressiva para lead silencioso.", stepOffsetsDays: [0, 2, 7] },
    { id: "proposal-revival", label: "Cadencia de proposta parada", description: "Pressao curta para propostas sem resposta.", stepOffsetsDays: [0, 2, 4] },
    { id: "meeting-prep", label: "Cadencia de preparacao", description: "Sequencia enxuta de preparo antes da reuniao.", stepOffsetsDays: [0] },
    { id: "opportunity-advance", label: "Cadencia de avancar oportunidade", description: "Dois toques para mover oportunidade ativa.", stepOffsetsDays: [1, 3] },
];

const CRM_PLAYBOOKS: CrmPlaybookDefinition[] = [
    {
        id: "follow-up-initial",
        label: "Follow-up inicial",
        description: "Inicia a cadencia de follow-up para leads em fila operacional.",
        viewIds: ["follow-up", "all"],
        cadenceId: "initial-follow-up",
        defaultPriority: "high",
        actionLabel: "Iniciar follow-up",
    },
    {
        id: "reactivate-silent-lead",
        label: "Reativar lead silencioso",
        description: "Retoma leads sem resposta recente com uma cadencia curta.",
        viewIds: ["quiet-window", "all"],
        cadenceId: "silent-reactivation",
        defaultPriority: "high",
        actionLabel: "Reativar lead",
    },
    {
        id: "revive-stalled-proposal",
        label: "Cobrar proposta parada",
        description: "Inicia retomada curta para propostas enviadas ou visualizadas.",
        viewIds: ["stalled-proposals", "all", "pipeline"],
        cadenceId: "proposal-revival",
        defaultPriority: "critical",
        actionLabel: "Cobrar proposta",
    },
    {
        id: "prepare-meeting",
        label: "Preparar reuniao",
        description: "Padroniza a preparacao de reunioes proximas.",
        viewIds: ["meetings", "all"],
        cadenceId: "meeting-prep",
        defaultPriority: "medium",
        actionLabel: "Preparar agenda",
    },
    {
        id: "confirm-meeting",
        label: "Confirmar reuniao",
        description: "Dispara playbook para confirmacao de agenda e envio de pauta.",
        viewIds: ["meetings", "all"],
        defaultPriority: "high",
        actionLabel: "Confirmar agenda",
    },
    {
        id: "log-meeting-result",
        label: "Registrar resultado da reuniao",
        description: "Alinha follow-up e documenta decisao canonica apos call.",
        viewIds: ["meetings", "all", "follow-up", "pipeline"],
        defaultPriority: "high",
        actionLabel: "Registrar resultado",
    },
    {
        id: "advance-opportunity",
        label: "Avancar oportunidade",
        description: "Empurra a proxima acao para oportunidade com deal ativo.",
        viewIds: ["pipeline", "follow-up", "all"],
        cadenceId: "opportunity-advance",
        defaultPriority: "high",
        actionLabel: "Avancar oportunidade",
    },
    {
        id: "advance-active-cadence",
        label: "Avancar cadencia ativa",
        description: "Move a cadencia atual para o proximo toque previsto.",
        viewIds: ["follow-up", "quiet-window", "stalled-proposals", "meetings", "pipeline", "all"],
        actionLabel: "Avancar cadencia",
    },
    {
        id: "resume-negotiation",
        label: "Retomar negociacao",
        description: "Inicia contato focado em quebrar objecao de preco ou decisao parada.",
        viewIds: ["revenue-risk", "stalled-proposals", "pipeline", "all"],
        defaultPriority: "high",
        actionLabel: "Retomar negociacao",
    },
    {
        id: "schedule-new-conversation",
        label: "Agendar nova conversa",
        description: "Busca reabrir agenda com o cliente para desbloqueio.",
        viewIds: ["pipeline", "follow-up", "revenue-risk", "all"],
        defaultPriority: "high",
        actionLabel: "Nova conversa",
    },
    {
        id: "log-loss",
        label: "Registrar perda",
        description: "Marca a perda e documenta o motivo canonico do lost.",
        viewIds: ["pipeline", "revenue-risk", "stalled-proposals", "all"],
        defaultPriority: "medium",
        actionLabel: "Registrar perda",
    },
];

const CRM_INLINE_PATCH_SCHEMA = z.object({
    field: z.custom<CrmEditableField>((value) => (
        typeof value === "string"
        && CRM_EDITABLE_FIELDS.includes(value as typeof CRM_EDITABLE_FIELDS[number])
    ), {
        message: "INVALID_EDITABLE_FIELD",
    }),
    value: z.string().trim().max(200),
});

const CRM_BULK_ACTION_SCHEMA = z.object({
    assessmentIds: z.array(z.string().trim().min(1)).min(1).max(CRM_BULK_ACTION_LIMIT),
    field: z.custom<CrmBulkEditableField>((value) => (
        typeof value === "string"
        && CRM_BULK_EDITABLE_FIELDS.includes(value as typeof CRM_BULK_EDITABLE_FIELDS[number])
    ), {
        message: "INVALID_BULK_FIELD",
    }),
    value: z.string().trim().max(200),
});

const CRM_SAVED_VIEW_SCHEMA = z.object({
    name: z.string().trim().min(2).max(60),
    scope: z.enum(["user", "tenant"]).default("user"),
    baseViewId: z.enum(["all", "follow-up", "stalled-proposals", "quiet-window", "meetings", "pipeline", "revenue-risk", "proposals"]),
    defaultMode: z.enum(["table", "board"]).default("table"),
    sortId: z.enum(["priority-desc", "last-touch-desc", "last-touch-asc", "next-meeting-asc", "company-asc"]).default("last-touch-desc"),
    columnIds: z.array(z.string().trim().min(1)).max(12).optional().default([]),
});

const CRM_PLAYBOOK_SCHEMA = z.object({
    assessmentIds: z.array(z.string().trim().min(1)).min(1).max(CRM_PLAYBOOK_ACTION_LIMIT),
    playbookId: z.enum([
        "follow-up-initial",
        "reactivate-silent-lead",
        "revive-stalled-proposal",
        "prepare-meeting",
        "confirm-meeting",
        "log-meeting-result",
        "advance-opportunity",
        "advance-active-cadence",
        "resume-negotiation",
        "log-loss",
        "schedule-new-conversation",
    ]),
    sourceViewId: z.enum(["all", "follow-up", "stalled-proposals", "quiet-window", "meetings", "pipeline", "revenue-risk", "proposals"]).optional().nullable(),
});

const ASSESSMENT_EXTENSION_EDITABLE_FIELDS: Partial<Record<FieldCatalogKey, CrmEditableField>> = {
    segment: "assessment.segment",
    urgency: "assessment.urgency",
    goal: "assessment.goal",
};

const QUICK_FILTERS = [
    { id: "all", label: "Tudo", description: "Visao completa do workspace" },
    { id: "attention", label: "Precisa de toque", description: "Unread, proposta em risco ou baixa atividade" },
    { id: "pipeline", label: "Pipeline vivo", description: "Registros ja com deal canonico" },
    { id: "inbox", label: "Com conversa", description: "Leads conectados ao WhatsApp CRM" },
];

const HEALTHCARE_APPOINTMENT_WINDOW_OPTIONS: CrmFieldOption[] = [
    { value: "Hoje", label: "Hoje" },
    { value: "24h", label: "24h" },
    { value: "48h", label: "48h" },
    { value: "Esta semana", label: "Esta semana" },
];

const HEALTHCARE_PROCEDURE_TYPE_OPTIONS: CrmFieldOption[] = [
    { value: "Consulta", label: "Consulta" },
    { value: "Retorno", label: "Retorno" },
    { value: "Exame", label: "Exame" },
    { value: "Procedimento", label: "Procedimento" },
];

const HEALTHCARE_INSURANCE_TYPE_OPTIONS: CrmFieldOption[] = [
    { value: "Particular", label: "Particular" },
    { value: "Convenio", label: "Convenio" },
    { value: "Misto", label: "Misto" },
];

const REAL_ESTATE_PROPERTY_INTEREST_OPTIONS: CrmFieldOption[] = [
    { value: "Descoberta", label: "Descoberta" },
    { value: "Comparando opcoes", label: "Comparando opcoes" },
    { value: "Visita agendada", label: "Visita agendada" },
    { value: "Pronto para proposta", label: "Pronto para proposta" },
];

const REAL_ESTATE_PROPERTY_TYPE_OPTIONS: CrmFieldOption[] = [
    { value: "Residencial", label: "Residencial" },
    { value: "Comercial", label: "Comercial" },
    { value: "Lancamento", label: "Lancamento" },
    { value: "Terreno", label: "Terreno" },
];

const REAL_ESTATE_BUDGET_RANGE_OPTIONS: CrmFieldOption[] = [
    { value: "Ate 500k", label: "Ate 500k" },
    { value: "500k-1M", label: "500k-1M" },
    { value: "1M-3M", label: "1M-3M" },
    { value: "3M+", label: "3M+" },
];

const LEGAL_AREA_OPTIONS: CrmFieldOption[] = [
    { value: "Civil", label: "Civil" },
    { value: "Trabalhista", label: "Trabalhista" },
    { value: "Empresarial", label: "Empresarial" },
    { value: "Tributario", label: "Tributario" },
    { value: "Familia", label: "Familia" },
];

const LEGAL_CASE_TYPE_OPTIONS: CrmFieldOption[] = [
    { value: "Consultivo", label: "Consultivo" },
    { value: "Contencioso", label: "Contencioso" },
    { value: "Contrato", label: "Contrato" },
    { value: "Audiencia", label: "Audiencia" },
];

const LEGAL_CASE_URGENCY_OPTIONS: CrmFieldOption[] = [
    { value: "Baixa", label: "Baixa" },
    { value: "Media", label: "Media" },
    { value: "Alta", label: "Alta" },
    { value: "Critica", label: "Critica" },
];

type FieldCatalogEntry = {
    label: string;
    valueType: CrmFieldValueType;
    options?: CrmFieldOption[];
};

const FIELD_CATALOG = {
    segment: { label: "Segmento", valueType: "text" as CrmFieldValueType },
    teamSize: { label: "Time", valueType: "text" as CrmFieldValueType },
    volumeDay: { label: "Volume/dia", valueType: "text" as CrmFieldValueType },
    urgency: { label: "Urgencia", valueType: "text" as CrmFieldValueType },
    goal: { label: "Objetivo", valueType: "text" as CrmFieldValueType },
    classification: { label: "Classificacao", valueType: "text" as CrmFieldValueType },
    scoreTotal: { label: "Score", valueType: "number" as CrmFieldValueType },
    city: { label: "Cidade", valueType: "text" as CrmFieldValueType },
    monthlyRevenue: { label: "Receita mensal", valueType: "currency" as CrmFieldValueType },
    monthlyLeads: { label: "Leads/mes", valueType: "number" as CrmFieldValueType },
    conversionRate: { label: "Conversao", valueType: "text" as CrmFieldValueType },
    responseTime: { label: "Tempo de resposta", valueType: "text" as CrmFieldValueType },
    hoursLost: { label: "Horas perdidas", valueType: "number" as CrmFieldValueType },
    crmUsage: { label: "CRM atual", valueType: "text" as CrmFieldValueType },
    automationLevel: { label: "Nivel de automacao", valueType: "text" as CrmFieldValueType },
    monthlyHoursRecovered: { label: "Horas recuperadas", valueType: "number" as CrmFieldValueType },
    estimatedPaybackMonths: { label: "Payback", valueType: "number" as CrmFieldValueType },
    procedureType: { label: "Procedimento", valueType: "select" as CrmFieldValueType, options: HEALTHCARE_PROCEDURE_TYPE_OPTIONS },
    insuranceType: { label: "Convenio", valueType: "select" as CrmFieldValueType, options: HEALTHCARE_INSURANCE_TYPE_OPTIONS },
    appointmentWindow: { label: "Janela", valueType: "select" as CrmFieldValueType, options: HEALTHCARE_APPOINTMENT_WINDOW_OPTIONS },
    propertyInterest: { label: "Interesse", valueType: "select" as CrmFieldValueType, options: REAL_ESTATE_PROPERTY_INTEREST_OPTIONS },
    propertyType: { label: "Imovel", valueType: "select" as CrmFieldValueType, options: REAL_ESTATE_PROPERTY_TYPE_OPTIONS },
    budgetRange: { label: "Faixa de valor", valueType: "select" as CrmFieldValueType, options: REAL_ESTATE_BUDGET_RANGE_OPTIONS },
    legalArea: { label: "Area", valueType: "select" as CrmFieldValueType, options: LEGAL_AREA_OPTIONS },
    caseType: { label: "Tipo de caso", valueType: "select" as CrmFieldValueType, options: LEGAL_CASE_TYPE_OPTIONS },
    caseUrgency: { label: "Urgencia do caso", valueType: "select" as CrmFieldValueType, options: LEGAL_CASE_URGENCY_OPTIONS },
} satisfies Record<string, FieldCatalogEntry>;

type FieldCatalogKey = keyof typeof FIELD_CATALOG;

function getFieldCatalogEntry(fieldId: FieldCatalogKey) {
    return FIELD_CATALOG[fieldId] as FieldCatalogEntry;
}

type NicheDefinition = {
    key: string;
    label: string;
    description: string;
    matchers: string[];
    tableFieldIds: FieldCatalogKey[];
    editableFieldIds: ControlledNicheEditableFieldId[];
    viewFieldIds: Partial<Record<CrmViewId, FieldCatalogKey[]>>;
    detailSections: CrmNicheSectionSchema[];
};

const NICHE_DEFINITIONS: NicheDefinition[] = [
    {
        key: "healthcare",
        label: "Healthcare CRM",
        description: "Leitura operacional para atendimento, agenda e resposta do funil de saude.",
        matchers: ["health", "clinic", "med", "saude", "odont", "hospital"],
        tableFieldIds: ["appointmentWindow", "procedureType", "insuranceType"],
        editableFieldIds: ["appointmentWindow", "procedureType", "insuranceType"],
        viewFieldIds: {
            all: ["appointmentWindow", "procedureType", "insuranceType"],
            "follow-up": ["appointmentWindow", "procedureType", "urgency"],
            "stalled-proposals": ["procedureType", "insuranceType"],
            "quiet-window": ["appointmentWindow", "responseTime"],
            meetings: ["appointmentWindow", "insuranceType"],
            pipeline: ["procedureType", "insuranceType"],
        },
        detailSections: [
            { id: "intake", title: "Intake e atendimento", description: "Campos para triagem, agenda e resposta.", fieldIds: ["appointmentWindow", "procedureType", "insuranceType", "urgency"] },
            { id: "context", title: "Contexto comercial", description: "Leitura adicional do lead dentro do nicho.", fieldIds: ["responseTime", "volumeDay", "goal", "teamSize"] },
        ],
    },
    {
        key: "education",
        label: "Education CRM",
        description: "Workspace para resposta, capacidade do time e conversao de matricula.",
        matchers: ["edu", "school", "course", "ensino", "faculdade"],
        tableFieldIds: ["monthlyLeads", "conversionRate", "teamSize"],
        editableFieldIds: [],
        viewFieldIds: {
            all: ["monthlyLeads", "conversionRate", "teamSize"],
            "follow-up": ["goal", "urgency", "responseTime"],
            "stalled-proposals": ["conversionRate", "goal"],
            "quiet-window": ["responseTime", "goal"],
            meetings: ["goal", "teamSize"],
            pipeline: ["monthlyLeads", "conversionRate"],
        },
        detailSections: [
            { id: "admissions", title: "Admissions", description: "Sinais de demanda, resposta e qualificacao.", fieldIds: ["monthlyLeads", "conversionRate", "responseTime", "goal"] },
            { id: "operations", title: "Operations", description: "Capacidade do time e pressao operacional.", fieldIds: ["teamSize", "hoursLost", "crmUsage"] },
        ],
    },
    {
        key: "commerce",
        label: "Commerce CRM",
        description: "Workspace comercial com foco em volume, conversao e pressao de operacao.",
        matchers: ["retail", "ecommerce", "commerce", "varejo", "loj"],
        tableFieldIds: ["monthlyRevenue", "monthlyLeads", "conversionRate"],
        editableFieldIds: [],
        viewFieldIds: {
            all: ["monthlyRevenue", "monthlyLeads", "conversionRate"],
            "follow-up": ["goal", "urgency", "responseTime"],
            "stalled-proposals": ["monthlyRevenue", "conversionRate"],
            "quiet-window": ["responseTime", "monthlyLeads"],
            meetings: ["goal", "monthlyRevenue"],
            pipeline: ["monthlyRevenue", "conversionRate"],
        },
        detailSections: [
            { id: "demand", title: "Demanda e conversao", description: "Volume e resposta do funil no nicho.", fieldIds: ["monthlyRevenue", "monthlyLeads", "conversionRate", "responseTime"] },
            { id: "ops", title: "Operacao", description: "Carga manual e estrutura atual.", fieldIds: ["hoursLost", "crmUsage", "automationLevel", "teamSize"] },
        ],
    },
    {
        key: "real-estate",
        label: "Real Estate CRM",
        description: "Workspace para interesse, imovel, faixa de valor e ritmo de follow-up imobiliario.",
        matchers: ["imobili", "real estate", "corret", "imovel"],
        tableFieldIds: ["propertyInterest", "propertyType", "budgetRange"],
        editableFieldIds: ["propertyInterest", "propertyType", "budgetRange"],
        viewFieldIds: {
            all: ["propertyInterest", "propertyType", "budgetRange"],
            "follow-up": ["propertyInterest", "budgetRange", "urgency"],
            "stalled-proposals": ["propertyType", "budgetRange"],
            "quiet-window": ["propertyInterest", "responseTime"],
            meetings: ["propertyType", "budgetRange"],
            pipeline: ["propertyInterest", "budgetRange"],
        },
        detailSections: [
            { id: "demand", title: "Demanda imobiliaria", description: "Interesse e faixa de valor do lead.", fieldIds: ["propertyInterest", "propertyType", "budgetRange", "goal"] },
            { id: "velocity", title: "Velocidade comercial", description: "Pressao de resposta e contexto do atendimento.", fieldIds: ["responseTime", "urgency", "city"] },
        ],
    },
    {
        key: "legal",
        label: "Legal CRM",
        description: "Workspace para area juridica, tipo de caso e urgencia do atendimento.",
        matchers: ["adv", "legal", "jurid", "law", "escritorio"],
        tableFieldIds: ["legalArea", "caseType", "caseUrgency"],
        editableFieldIds: ["legalArea", "caseType", "caseUrgency"],
        viewFieldIds: {
            all: ["legalArea", "caseType", "caseUrgency"],
            "follow-up": ["caseUrgency", "legalArea", "goal"],
            "stalled-proposals": ["caseType", "caseUrgency"],
            "quiet-window": ["caseUrgency", "responseTime"],
            meetings: ["legalArea", "caseUrgency"],
            pipeline: ["legalArea", "caseType"],
        },
        detailSections: [
            { id: "case", title: "Contexto do caso", description: "Area, tipo e urgencia juridica.", fieldIds: ["legalArea", "caseType", "caseUrgency", "goal"] },
            { id: "ops", title: "Operacao", description: "Capacidade e velocidade de resposta.", fieldIds: ["teamSize", "responseTime", "hoursLost"] },
        ],
    },
    {
        key: "services",
        label: "Services CRM",
        description: "Workspace operacional para servicos, vendas consultivas e follow-up.",
        matchers: ["service", "consult", "agency", "servic", "software", "saas"],
        tableFieldIds: ["monthlyRevenue", "responseTime", "hoursLost"],
        editableFieldIds: [],
        viewFieldIds: {
            all: ["monthlyRevenue", "responseTime", "hoursLost"],
            "follow-up": ["goal", "urgency", "responseTime"],
            "stalled-proposals": ["monthlyRevenue", "goal"],
            "quiet-window": ["urgency", "responseTime"],
            meetings: ["goal", "monthlyRevenue"],
            pipeline: ["monthlyRevenue", "hoursLost"],
        },
        detailSections: [
            { id: "commercial-context", title: "Commercial context", description: "Sinais de pressao e potencial comercial.", fieldIds: ["monthlyRevenue", "responseTime", "hoursLost", "goal"] },
            { id: "delivery-context", title: "Delivery context", description: "Capacidade operacional e stack atual.", fieldIds: ["teamSize", "crmUsage", "automationLevel", "volumeDay"] },
        ],
    },
];

const DEFAULT_NICHE: NicheDefinition = {
    key: "general",
    label: "Adaptive CRM",
    description: "Workspace canonico com extensoes controladas por metadado.",
    matchers: [],
    tableFieldIds: ["segment", "teamSize", "goal"],
    editableFieldIds: [],
    viewFieldIds: {
        all: ["segment", "teamSize", "goal"],
        "follow-up": ["goal", "urgency", "teamSize"],
        "stalled-proposals": ["segment", "goal"],
        "quiet-window": ["goal", "urgency"],
        meetings: ["goal", "segment"],
        pipeline: ["segment", "teamSize"],
    },
    detailSections: [
        { id: "context", title: "Contexto operacional", description: "Campos adicionais definidos pelo schema do tenant.", fieldIds: ["segment", "teamSize", "urgency", "goal"] },
    ],
};

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
    if (!value || !value.trim()) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
        return {};
    }
}

function parseJsonArray(value: string | null | undefined): string[] {
    if (!value || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
        return [];
    }
}

function parseNestedJsonObject(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

type WorkspaceCadenceState = {
    id: CrmCadenceId;
    step: number;
    totalSteps: number;
    dueAt: string | null;
};

function parseWorkspaceCadence(value: unknown): WorkspaceCadenceState | null {
    const cadence = parseNestedJsonObject(value);
    if (typeof cadence.id !== "string" || typeof cadence.step !== "number" || typeof cadence.totalSteps !== "number") {
        return null;
    }

    const cadenceTemplate = CRM_CADENCE_TEMPLATES.find((template) => template.id === cadence.id);
    if (!cadenceTemplate) return null;

    return {
        id: cadence.id as CrmCadenceId,
        step: cadence.step,
        totalSteps: cadence.totalSteps,
        dueAt: typeof cadence.dueAt === "string" ? cadence.dueAt : null,
    };
}

export function parseWorkspaceMetadata(value: string | null | undefined) {
    const root = parseJsonObject(value);
    const workspace = parseNestedJsonObject(root.crmWorkspace);
    const nicheValues = parseNestedJsonObject(workspace.nicheValues);
    const cadence = parseWorkspaceCadence(workspace.cadence);

    return {
        root,
        workspace,
        nicheValues,
        priority: typeof workspace.priority === "string" ? workspace.priority : null,
        nextAction: typeof workspace.nextAction === "string" ? workspace.nextAction : "",
        nextActionAt: typeof workspace.nextActionAt === "string" ? workspace.nextActionAt : null,
        lostReason: typeof workspace.lostReason === "string" ? workspace.lostReason : null,
        cadence,
    };
}

function serializeWorkspaceMetadata(
    currentValue: string | null | undefined,
    patch: {
        priority?: string | null;
        nextAction?: string | null;
        nextActionAt?: string | null;
        lostReason?: string | null;
        nicheValues?: Record<string, string | null | undefined>;
        cadence?: WorkspaceCadenceState | null;
    },
) {
    const parsed = parseWorkspaceMetadata(currentValue);
    const nextRoot: Record<string, unknown> = Object.keys(parsed.root).length > 0
        ? { ...parsed.root }
        : currentValue && currentValue.trim()
            ? { legacyNotesText: currentValue }
            : {};
    const nextWorkspace = { ...parsed.workspace };

    if (typeof patch.priority !== "undefined") {
        if (patch.priority) nextWorkspace.priority = patch.priority;
        else delete nextWorkspace.priority;
    }

    if (typeof patch.nextAction !== "undefined") {
        if (patch.nextAction) nextWorkspace.nextAction = patch.nextAction;
        else delete nextWorkspace.nextAction;
    }

    if (typeof patch.nextActionAt !== "undefined") {
        if (patch.nextActionAt) nextWorkspace.nextActionAt = patch.nextActionAt;
        else delete nextWorkspace.nextActionAt;
    }

    if (typeof patch.lostReason !== "undefined") {
        if (patch.lostReason) nextWorkspace.lostReason = patch.lostReason;
        else delete nextWorkspace.lostReason;
    }

    if (patch.nicheValues) {
        const nextNicheValues = { ...parsed.nicheValues };
        for (const [key, value] of Object.entries(patch.nicheValues)) {
            if (value) nextNicheValues[key] = value;
            else delete nextNicheValues[key];
        }
        if (Object.keys(nextNicheValues).length > 0) nextWorkspace.nicheValues = nextNicheValues;
        else delete nextWorkspace.nicheValues;
    }

    if (typeof patch.cadence !== "undefined") {
        if (patch.cadence) nextWorkspace.cadence = patch.cadence;
        else delete nextWorkspace.cadence;
    }

    if (Object.keys(nextWorkspace).length > 0) nextRoot.crmWorkspace = nextWorkspace;
    else delete nextRoot.crmWorkspace;

    return JSON.stringify(nextRoot);
}

function formatDateTime(value: string | Date | null | undefined): string {
    if (!value) return "Sem toque recente";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function mergeCrmInboxFeedItems<T extends { createdAt: Date }>(
    whatsappItems: T[],
    emailItems: T[],
): T[] {
    return [...whatsappItems, ...emailItems]
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(0, 12);
}

function formatDate(value: string | Date | null | undefined): string {
    if (!value) return "-";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function formatCurrencyBRL(value: number | null | undefined): string {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    }).format(value);
}

function normalizeIndustry(industry: string): string {
    return String(industry || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

export function resolveCrmNicheDefinition(industry: string): NicheDefinition {
    const normalized = normalizeIndustry(industry);
    return NICHE_DEFINITIONS.find((definition) => definition.matchers.some((matcher) => normalized.includes(matcher))) ?? DEFAULT_NICHE;
}

export function parseCrmInlinePatchInput(value: unknown) {
    return CRM_INLINE_PATCH_SCHEMA.safeParse(value);
}

function resolveViewIdsForProposalStatus(proposalStatus: string): CrmViewId[] {
    if (proposalStatus === "none") return [];

    const base: CrmViewId[] = ["proposals"];
    if (proposalStatus === "sent" || proposalStatus === "viewed") {
        base.push("stalled-proposals");
    }

    return base;
}

export function parseCrmBulkActionInput(value: unknown) {
    return CRM_BULK_ACTION_SCHEMA.safeParse(value);
}

export function parseCrmPlaybookInput(value: unknown) {
    return CRM_PLAYBOOK_SCHEMA.safeParse(value);
}

function buildCrmSavedViewError(message: string) {
    return {
        flatten: () => ({
            fieldErrors: {},
            formErrors: [message],
        }),
    };
}

export function parseCrmSavedViewInput(
    value: unknown,
    input: {
        columns: CrmWorkspaceColumn[];
        presets: CrmWorkspaceViewPreset[];
    },
) {
    const parsed = CRM_SAVED_VIEW_SCHEMA.safeParse(value);
    if (!parsed.success) return parsed;

    const systemView = input.presets.find((preset) => preset.kind === "system" && preset.baseViewId === parsed.data.baseViewId);
    if (!systemView) {
        return {
            success: false as const,
            error: buildCrmSavedViewError("INVALID_BASE_VIEW"),
        };
    }

    const allowedColumnIds = new Set(
        input.columns
            .filter((column) => column.viewIds.includes(parsed.data.baseViewId))
            .map((column) => column.id),
    );
    const requestedColumnIds = parsed.data.columnIds.length > 0
        ? Array.from(new Set(parsed.data.columnIds))
        : systemView.columnIds;

    if (requestedColumnIds.length === 0 || requestedColumnIds.some((columnId) => !allowedColumnIds.has(columnId))) {
        return {
            success: false as const,
            error: buildCrmSavedViewError("INVALID_VIEW_COLUMNS"),
        };
    }

    return {
        success: true as const,
        data: {
            ...parsed.data,
            columnIds: requestedColumnIds,
        },
    };
}

function resolveTone(input: { unreadCount: number; proposalStatus: string; nextMeetingLabel: string; activityCount: number }): CrmTone {
    if (input.unreadCount > 0 || input.proposalStatus === "sent") return "warning";
    if (input.proposalStatus === "accepted" || input.nextMeetingLabel !== "Sem agenda") return "positive";
    if (input.activityCount === 0) return "neutral";
    return "neutral";
}

function deriveStageLabel(stageName: string | null | undefined): string {
    return stageName?.trim() || "Sem deal";
}

function buildBoardColumnId(stageId: string | null | undefined): string {
    return stageId || "no-deal";
}

function formatLifecycleLabel(value: string | null | undefined): string {
    if (!value) return "Lead";
    return value.split("_").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}

function summarizeProposal(proposal: { status?: string | null; version?: number | null; pricingEstimate?: string | null } | null | undefined) {
    if (!proposal) return { status: "none", label: "Sem proposta" };
    const pricing = parseJsonObject(proposal.pricingEstimate ?? null);
    const minBRL = typeof pricing.minBRL === "number" ? pricing.minBRL : null;
    const maxBRL = typeof pricing.maxBRL === "number" ? pricing.maxBRL : null;
    const valueLabel = minBRL || maxBRL
        ? `${formatCurrencyBRL(minBRL)}${maxBRL && maxBRL !== minBRL ? ` - ${formatCurrencyBRL(maxBRL)}` : ""}`
        : `v${proposal.version ?? 1}`;
    return { status: proposal.status ?? "draft", label: `${proposal.status ?? "draft"} · ${valueLabel}` };
}

function resolveExtensionValue(
    fieldId: FieldCatalogKey,
    input: { assessment: Record<string, unknown>; internalContext: Record<string, unknown>; roi: Record<string, unknown>; nicheValues?: Record<string, unknown> },
): string {
    const assessmentValue = input.assessment[fieldId];
    const internalValue = input.internalContext[fieldId];
    const roiValue = input.roi[fieldId];
    const nicheValue = input.nicheValues?.[fieldId];
    const raw = typeof assessmentValue !== "undefined"
        ? assessmentValue
        : typeof internalValue !== "undefined"
            ? internalValue
            : typeof nicheValue !== "undefined"
                ? nicheValue
                : roiValue;
    if (raw === null || typeof raw === "undefined" || raw === "") return "-";
    if (fieldId === "estimatedPaybackMonths" && typeof raw === "number") return `${raw.toFixed(1)} meses`;
    if (fieldId === "monthlyRevenue" && typeof raw === "number") return formatCurrencyBRL(raw);
    if (fieldId === "monthlyHoursRecovered" && typeof raw === "number") return `${raw.toFixed(0)} h`;
    return String(raw);
}

function collectWorkspaceFieldIds(niche: NicheDefinition): FieldCatalogKey[] {
    const fieldIds = new Set<FieldCatalogKey>(niche.tableFieldIds);

    for (const viewFieldIds of Object.values(niche.viewFieldIds)) {
        for (const fieldId of viewFieldIds ?? []) fieldIds.add(fieldId);
    }

    return Array.from(fieldIds);
}

function resolveViewFieldIds(viewId: CrmViewId, niche: NicheDefinition): FieldCatalogKey[] {
    return niche.viewFieldIds[viewId] ?? niche.tableFieldIds;
}

function resolveViewIdsForField(fieldId: string, niche: NicheDefinition): CrmViewId[] {
    const viewIds = (Object.entries(niche.viewFieldIds) as Array<[CrmViewId, FieldCatalogKey[] | undefined]>)
        .filter(([, fieldIds]) => (fieldIds ?? []).includes(fieldId as FieldCatalogKey))
        .map(([viewId]) => viewId);

    return viewIds.length > 0 ? viewIds : ["all"];
}

function resolveEditableFieldForCatalog(fieldId: FieldCatalogKey, niche: NicheDefinition): CrmEditableField | undefined {
    if (ASSESSMENT_EXTENSION_EDITABLE_FIELDS[fieldId]) {
        return ASSESSMENT_EXTENSION_EDITABLE_FIELDS[fieldId];
    }

    if (niche.editableFieldIds.includes(fieldId as ControlledNicheEditableFieldId)) {
        return `workspace.niche.${fieldId as ControlledNicheEditableFieldId}`;
    }

    return undefined;
}

function buildWorkspaceColumns(
    niche: NicheDefinition,
    stageOptions: CrmFieldOption[],
    ownerOptions: CrmFieldOption[],
): CrmWorkspaceColumn[] {
    return [
        { id: "company", label: "Conta", kind: "text", valueType: "text", viewIds: ["all", "follow-up", "stalled-proposals", "quiet-window", "meetings", "pipeline", "revenue-risk", "proposals"] },
        { id: "status", label: "Status", kind: "status", valueType: "select", options: ASSESSMENT_STATUS_OPTIONS, viewIds: ["all", "quiet-window", "revenue-risk", "proposals"], editableField: "assessment.status" },
        { id: "stage", label: "Stage", kind: "stage", valueType: "select", options: stageOptions, viewIds: ["all", "stalled-proposals", "meetings", "pipeline", "revenue-risk", "proposals"], editableField: "deal.stageId" },
        { id: "lifecycle", label: "Lifecycle", kind: "lifecycle", valueType: "select", options: CONTACT_LIFECYCLE_OPTIONS, viewIds: ["all", "proposals"], editableField: "contact.lifecycle" },
        { id: "owner", label: "Responsavel", kind: "text", valueType: "select", options: ownerOptions, viewIds: ["follow-up", "stalled-proposals", "quiet-window", "meetings", "pipeline", "revenue-risk", "proposals"], editableField: "conversation.assignedUserId" },
        { id: "priority", label: "Prioridade", kind: "text", valueType: "select", options: PRIORITY_OPTIONS, viewIds: ["all", "follow-up", "stalled-proposals", "meetings", "pipeline", "revenue-risk", "proposals"], editableField: "workspace.priority" },
        { id: "lostReason", label: "Motivo Perda", kind: "text", valueType: "select", options: LOSS_REASON_OPTIONS, viewIds: ["all", "stalled-proposals", "revenue-risk", "pipeline"], editableField: "workspace.lostReason" },
        { id: "nextAction", label: "Proxima acao", kind: "text", valueType: "text", viewIds: ["follow-up", "stalled-proposals", "quiet-window", "meetings", "revenue-risk", "proposals"], editableField: "workspace.nextAction" },
        { id: "nextActionAt", label: "Proxima data", kind: "text", valueType: "datetime", viewIds: ["follow-up", "quiet-window", "revenue-risk", "proposals"], editableField: "workspace.nextActionAt" },
        { id: "cadence", label: "Cadencia", kind: "text", valueType: "text", viewIds: ["follow-up", "stalled-proposals", "quiet-window", "meetings", "pipeline", "revenue-risk", "proposals"] },
        { id: "recommendation", label: "Recomendacao", kind: "text", valueType: "text", viewIds: ["follow-up", "stalled-proposals", "quiet-window", "meetings", "pipeline", "revenue-risk", "proposals"] },
        { id: "proposal", label: "Proposta", kind: "status", valueType: "select", options: PROPOSAL_STATUS_OPTIONS, viewIds: ["all", "proposals", "stalled-proposals", "pipeline", "revenue-risk"], editableField: "proposal.status" },
        { id: "lastTouch", label: "Ultimo toque", kind: "text", valueType: "datetime", viewIds: ["all", "follow-up", "stalled-proposals", "quiet-window", "pipeline"] },
        { id: "nextMeeting", label: "Agenda", kind: "text", valueType: "datetime", viewIds: ["meetings"] },
        ...collectWorkspaceFieldIds(niche).map((fieldId) => ({
            id: fieldId,
            label: getFieldCatalogEntry(fieldId).label,
            kind: "metric" as CrmColumnKind,
            valueType: getFieldCatalogEntry(fieldId).valueType,
            options: getFieldCatalogEntry(fieldId).options,
            viewIds: resolveViewIdsForField(fieldId, niche),
            editableField: resolveEditableFieldForCatalog(fieldId, niche),
        })),
    ];
}

function buildDetailEditorDefinitions(
    niche: NicheDefinition,
    stageOptions: CrmFieldOption[],
    ownerOptions: CrmFieldOption[],
): CrmDetailEditorDefinition[] {
    const workflowEditors: CrmDetailEditorDefinition[] = [
        { id: "status", field: "assessment.status", columnId: "status", label: "Status", valueType: "select", options: ASSESSMENT_STATUS_OPTIONS, section: "workflow" },
        { id: "lifecycle", field: "contact.lifecycle", columnId: "lifecycle", label: "Lifecycle", valueType: "select", options: CONTACT_LIFECYCLE_OPTIONS, section: "workflow" },
        { id: "stage", field: "deal.stageId", columnId: "stage", label: "Stage", valueType: "select", options: stageOptions, section: "workflow" },
        { id: "owner", field: "conversation.assignedUserId", columnId: "owner", label: "Responsavel", valueType: "select", options: ownerOptions, section: "workflow" },
        { id: "priority", field: "workspace.priority", columnId: "priority", label: "Prioridade", valueType: "select", options: PRIORITY_OPTIONS, section: "workflow" },
        { id: "lostReason", field: "workspace.lostReason", columnId: "lostReason", label: "Motivo Perda", valueType: "select", options: LOSS_REASON_OPTIONS, section: "workflow" },
        { id: "nextAction", field: "workspace.nextAction", columnId: "nextAction", label: "Proxima acao", valueType: "text", section: "workflow" },
        { id: "nextActionAt", field: "workspace.nextActionAt", columnId: "nextActionAt", label: "Proxima data", valueType: "datetime", section: "workflow" },
    ];

    const qualificationEditors: CrmDetailEditorDefinition[] = [
        { id: "segment", field: "assessment.segment", columnId: "segment", label: "Segmento", valueType: "text", section: "qualification" },
        { id: "urgency", field: "assessment.urgency", columnId: "urgency", label: "Urgencia", valueType: "text", section: "qualification" },
        { id: "goal", field: "assessment.goal", columnId: "goal", label: "Objetivo", valueType: "text", section: "qualification" },
    ];

    const nicheEditors = niche.editableFieldIds.map((fieldId) => ({
        id: fieldId,
        field: `workspace.niche.${fieldId}` as CrmEditableField,
        columnId: fieldId,
        label: getFieldCatalogEntry(fieldId).label,
        valueType: getFieldCatalogEntry(fieldId).valueType,
        options: getFieldCatalogEntry(fieldId).options,
        section: "niche" as CrmDetailEditorSection,
    }));

    return [...workflowEditors, ...qualificationEditors, ...nicheEditors];
}

function normalizeSavedViewId(rawId: string) {
    return rawId.startsWith("saved:") ? rawId : `saved:${rawId}`;
}

function buildViewPresets(niche: NicheDefinition): CrmWorkspaceViewPreset[] {
    const uniqueColumns = (columnIds: string[]) => Array.from(new Set(columnIds));

    return [
        {
            id: "all",
            kind: "system",
            baseViewId: "all",
            label: "Todos os leads",
            description: "Visao completa do workspace comercial.",
            defaultMode: "table",
            sortId: "last-touch-desc",
            columnIds: uniqueColumns(["company", "status", "stage", "lifecycle", "priority", "proposal", "lastTouch", ...resolveViewFieldIds("all", niche)]),
        },
        {
            id: "follow-up",
            kind: "system",
            baseViewId: "follow-up",
            label: "Aguardando follow-up",
            description: "Fila de follow-up, dono, prioridade e proxima acao.",
            defaultMode: "table",
            sortId: "priority-desc",
            columnIds: uniqueColumns(["company", "owner", "priority", "cadence", "recommendation", "nextAction", "nextActionAt", "lastTouch", ...resolveViewFieldIds("follow-up", niche)]),
        },
        {
            id: "stalled-proposals",
            kind: "system",
            baseViewId: "stalled-proposals",
            label: "Propostas paradas",
            description: "Propostas que pedem reengajamento rapido.",
            defaultMode: "table",
            sortId: "last-touch-asc",
            columnIds: uniqueColumns(["company", "stage", "owner", "priority", "cadence", "recommendation", "proposal", "lastTouch", "nextAction", ...resolveViewFieldIds("stalled-proposals", niche)]),
        },
        {
            id: "proposals",
            kind: "system",
            baseViewId: "proposals",
            label: "Propostas",
            description: "Visao operacional de todas as propostas e seus status.",
            defaultMode: "table",
            sortId: "last-touch-asc",
            columnIds: uniqueColumns(["company", "stage", "proposal", "status", "owner", "priority", "recommendation", "nextAction", "lastTouch", ...resolveViewFieldIds("proposals", niche)]),
        },
        {
            id: "revenue-risk",
            kind: "system",
            baseViewId: "revenue-risk",
            label: "Receita em risco",
            description: "Oportunidades que precisam de follow-up urgente pelo Risk Engine.",
            defaultMode: "table",
            sortId: "priority-desc",
            columnIds: uniqueColumns(["company", "stage", "owner", "priority", "recommendation", "proposal", "lastTouch", ...resolveViewFieldIds("revenue-risk", niche)]),
        },
        {
            id: "quiet-window",
            kind: "system",
            baseViewId: "quiet-window",
            label: "Sem resposta recente",
            description: "Registros com pouca interacao recente.",
            defaultMode: "table",
            sortId: "last-touch-asc",
            columnIds: uniqueColumns(["company", "status", "owner", "cadence", "recommendation", "lastTouch", "nextAction", "nextActionAt", ...resolveViewFieldIds("quiet-window", niche)]),
        },
        {
            id: "meetings",
            kind: "system",
            baseViewId: "meetings",
            label: "Reunioes proximas",
            description: "Agenda curta e proximo passo operacional.",
            defaultMode: "board",
            sortId: "next-meeting-asc",
            columnIds: uniqueColumns(["company", "owner", "nextMeeting", "cadence", "recommendation", "nextAction", "priority", "stage", ...resolveViewFieldIds("meetings", niche)]),
        },
        {
            id: "pipeline",
            kind: "system",
            baseViewId: "pipeline",
            label: "Por stage",
            description: "Pipeline vivo em board por etapa canonica.",
            defaultMode: "board",
            sortId: "priority-desc",
            columnIds: uniqueColumns(["company", "stage", "owner", "priority", "cadence", "recommendation", "proposal", "lastTouch", ...resolveViewFieldIds("pipeline", niche)]),
        },
    ];
}

function buildBulkActionDefinitions(
    stageOptions: CrmFieldOption[],
    ownerOptions: CrmFieldOption[],
): CrmBulkActionDefinition[] {
    return [
        {
            id: "assessment-status",
            field: "assessment.status",
            label: "Status do assessment",
            description: "Atualiza o status canonico do assessment.",
            valueType: "select",
            options: ASSESSMENT_STATUS_OPTIONS,
        },
        {
            id: "contact-lifecycle",
            field: "contact.lifecycle",
            label: "Lifecycle do contato",
            description: "Move o contato entre lead, opportunity e client.",
            valueType: "select",
            options: CONTACT_LIFECYCLE_OPTIONS,
        },
        {
            id: "deal-stage",
            field: "deal.stageId",
            label: "Stage do deal",
            description: "Move deals no pipeline canonico.",
            valueType: "select",
            options: stageOptions,
        },
        {
            id: "owner",
            field: "conversation.assignedUserId",
            label: "Responsavel",
            description: "Redistribui a carteira selecionada.",
            valueType: "select",
            options: ownerOptions,
        },
        {
            id: "priority",
            field: "workspace.priority",
            label: "Prioridade",
            description: "Atualiza a prioridade operacional.",
            valueType: "select",
            options: PRIORITY_OPTIONS,
        },
        {
            id: "proposal-status",
            field: "proposal.status",
            label: "Status da proposta",
            description: "Atualiza o status da proposta vinculada ao assessment.",
            valueType: "select",
            options: PROPOSAL_STATUS_OPTIONS,
        },
        {
            id: "next-action",
            field: "workspace.nextAction",
            label: "Proxima acao",
            description: "Define a proxima acao do lote.",
            valueType: "text",
            placeholder: "Ex.: Cobrar proposta",
        },
        {
            id: "next-action-at",
            field: "workspace.nextActionAt",
            label: "Proxima data",
            description: "Agenda o proximo toque operacional.",
            valueType: "datetime",
        },
    ];
}

function buildWorkflowShortcuts(): Record<CrmViewId, CrmWorkflowShortcut[]> {
    return {
        all: [],
        "follow-up": [
            {
                id: "follow-up-next-touch",
                label: "Marcar proximos contatos",
                description: "Prefill para a fila de follow-up.",
                field: "workspace.nextAction",
                suggestedValue: "Realizar follow-up",
            },
        ],
        "quiet-window": [
            {
                id: "quiet-window-reactivate",
                label: "Reativar fila",
                description: "Prefill para retomar contas sem resposta recente.",
                field: "workspace.nextAction",
                suggestedValue: "Reativar fila",
            },
        ],
        meetings: [
            {
                id: "meetings-prepare",
                label: "Preparar agenda",
                description: "Prefill para preparar a reuniao.",
                field: "workspace.nextAction",
                suggestedValue: "Preparar agenda",
            },
        ],
        "stalled-proposals": [
            {
                id: "stalled-proposals-chase",
                label: "Cobrar proposta",
                description: "Prefill para retomar propostas em risco.",
                field: "workspace.nextAction",
                suggestedValue: "Cobrar proposta",
            },
        ],
        "revenue-risk": [
            {
                id: "revenue-risk-prioritize",
                label: "Priorizar receita em risco",
                description: "Ajustar proxima acao para oportunidades de maior risco.",
                field: "workspace.nextAction",
                suggestedValue: "Cobrar proposta de vazamento",
            },
        ],
        proposals: [
            {
                id: "proposals-follow-up",
                label: "Revisar proposta aberta",
                description: "Ação rápida para propostas enviadas ou visualizadas.",
                field: "workspace.nextAction",
                suggestedValue: "Enviar lembrete de proposta",
            },
            {
                id: "proposals-register-response",
                label: "Registrar resposta",
                description: "Marcar se o cliente respondeu e atualizar status.",
                field: "workspace.nextAction",
                suggestedValue: "Confirmar recebimento e alinhar próximo passo",
            },
        ],
        pipeline: [
            {
                id: "pipeline-move-stage",
                label: "Mover estagio",
                description: "Atalho para bulk de stage do deal.",
                field: "deal.stageId",
                suggestedValue: "",
            },
        ],
    };
}

function resolveCadenceTemplate(cadenceId: CrmCadenceId | null | undefined) {
    return CRM_CADENCE_TEMPLATES.find((template) => template.id === cadenceId) ?? null;
}

export function formatCadenceLabel(cadence: WorkspaceCadenceState | null | undefined) {
    if (!cadence) return "-";
    const cadenceTemplate = resolveCadenceTemplate(cadence.id);
    if (!cadenceTemplate) return "-";
    return `${cadenceTemplate.label} · passo ${cadence.step}/${cadence.totalSteps}`;
}

function buildPlaybooksByView(): Record<CrmViewId, CrmPlaybookDefinition[]> {
    return {
        all: CRM_PLAYBOOKS.filter((playbook) => playbook.viewIds.includes("all") && playbook.id !== "advance-active-cadence"),
        "follow-up": CRM_PLAYBOOKS.filter((playbook) => playbook.viewIds.includes("follow-up") && playbook.id !== "advance-active-cadence"),
        "stalled-proposals": CRM_PLAYBOOKS.filter((playbook) => playbook.viewIds.includes("stalled-proposals") && playbook.id !== "advance-active-cadence"),
        "quiet-window": CRM_PLAYBOOKS.filter((playbook) => playbook.viewIds.includes("quiet-window") && playbook.id !== "advance-active-cadence"),
        meetings: CRM_PLAYBOOKS.filter((playbook) => playbook.viewIds.includes("meetings") && playbook.id !== "advance-active-cadence"),
        pipeline: CRM_PLAYBOOKS.filter((playbook) => playbook.viewIds.includes("pipeline") && playbook.id !== "advance-active-cadence"),
        "revenue-risk": CRM_PLAYBOOKS.filter((playbook) => playbook.viewIds.includes("revenue-risk") && playbook.id !== "advance-active-cadence"),
        proposals: CRM_PLAYBOOKS.filter((playbook) => playbook.viewIds.includes("proposals") && playbook.id !== "advance-active-cadence"),
    };
}

export function buildRecommendedActions(input: {
    cadence: WorkspaceCadenceState | null;
    unreadCount: number;
    proposalStatus: string;
    hasUpcomingMeeting: boolean;
    hasDeal: boolean;
    needsAttention: boolean;
}): CrmRecommendedAction[] {
    const recommendations: CrmRecommendedAction[] = [];

    if (input.cadence && input.cadence.step < input.cadence.totalSteps) {
        recommendations.push({
            id: "advance-active-cadence",
            title: `Avancar para o passo ${input.cadence.step + 1}`,
            reason: `Cadencia ativa em curso (${formatCadenceLabel(input.cadence)}).`,
            playbookId: "advance-active-cadence",
            actionLabel: "Avancar cadencia",
        });
    }

    if (input.proposalStatus === "sent" || input.proposalStatus === "viewed") {
        recommendations.push({
            id: "revive-stalled-proposal",
            title: "Cobrar proposta parada",
            reason: "A proposta foi enviada ou visualizada e pede retomada curta.",
            playbookId: "revive-stalled-proposal",
            actionLabel: "Cobrar proposta",
        });
    }

    if (input.hasUpcomingMeeting) {
        recommendations.push({
            id: "prepare-meeting",
            title: "Preparar reuniao",
            reason: "Existe agenda proxima conectada ao registro.",
            playbookId: "prepare-meeting",
            actionLabel: "Preparar agenda",
        });
    }

    if (input.needsAttention || input.unreadCount > 0) {
        recommendations.push({
            id: "follow-up-initial",
            title: "Executar follow-up inicial",
            reason: input.unreadCount > 0
                ? "Ha conversa pendente e o lead pede resposta curta."
                : "O registro esta na fila de follow-up e precisa de proximo toque.",
            playbookId: "follow-up-initial",
            actionLabel: "Iniciar follow-up",
        });
    }

    if (!input.hasUpcomingMeeting && !input.hasDeal && input.needsAttention) {
        recommendations.push({
            id: "reactivate-silent-lead",
            title: "Reativar lead silencioso",
            reason: "O lead esfriou e pede retomada com cadencia curta.",
            playbookId: "reactivate-silent-lead",
            actionLabel: "Reativar lead",
        });
    }

    if (input.hasDeal) {
        recommendations.push({
            id: "advance-opportunity",
            title: "Avancar oportunidade",
            reason: "O registro ja tem deal canonico e pede proximo passo comercial.",
            playbookId: "advance-opportunity",
            actionLabel: "Avancar oportunidade",
        });
    }

    return recommendations.slice(0, 3);
}

function resolveConversationStatusLabel(status: string | null | undefined) {
    if (status === "closed") return "Fechada";
    if (status === "snoozed") return "Adiada";
    return "Aberta";
}

function summarizeTimelineText(value: string | null | undefined, fallback: string) {
    const normalized = value?.replace(/\s+/g, " ").trim();
    if (!normalized) return fallback;
    return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

export function composeCrmRecordTimeline(input: {
    messages: Array<{ id: string; direction: "inbound" | "outbound"; text: string; statusLabel: string; at: string }>;
    activities: CrmRecordTimelineItem[];
    proposals: CrmRecordTimelineItem[];
    meetings: CrmRecordTimelineItem[];
}): CrmRecordLiveTimelineItem[] {
    const items: CrmRecordLiveTimelineItem[] = [
        ...input.messages.slice(0, 4).map((message) => ({
            id: `message:${message.id}`,
            kind: "message" as const,
            title: message.direction === "inbound" ? "Mensagem recebida" : "Mensagem enviada",
            detail: `${summarizeTimelineText(message.text, "Mensagem sem corpo")} · ${message.statusLabel}`,
            eyebrow: message.direction === "inbound" ? "conversa" : "whatsapp",
            at: message.at,
            tone: (message.direction === "inbound" ? "warning" : "neutral") as CrmTone,
        })),
        ...input.activities.slice(0, 4).map((activity) => ({
            ...activity,
            id: `activity:${activity.id}`,
            kind: "activity" as const,
        })),
        ...input.proposals.slice(0, 3).map((proposal) => ({
            ...proposal,
            id: `proposal:${proposal.id}`,
            kind: "proposal" as const,
        })),
        ...input.meetings.slice(0, 3).map((meeting) => ({
            ...meeting,
            id: `meeting:${meeting.id}`,
            kind: "meeting" as const,
        })),
    ];

    return items
        .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
        .slice(0, 10);
}

function buildCrmOperationalSummary(input: {
    lastInteractionAt: string | null;
    unreadCount: number;
    proposalStatus: string;
    nextAction: string;
    nextActionAt: string | null;
    recommendations: CrmRecommendedAction[];
    hasUpcomingMeeting: boolean;
}): CrmRecordOperationalSummary {
    let pendingLabel = "Sem pendencia critica agora.";

    if (input.unreadCount > 0) {
        pendingLabel = `${input.unreadCount} mensagens aguardam retorno no canal.`;
    } else if (input.nextActionAt && new Date(input.nextActionAt).getTime() < Date.now()) {
        pendingLabel = `A proxima acao venceu em ${formatDateTime(input.nextActionAt)}.`;
    } else if (input.proposalStatus === "sent" || input.proposalStatus === "viewed") {
        pendingLabel = "Existe proposta aguardando retomada comercial.";
    } else if (input.hasUpcomingMeeting && input.nextActionAt) {
        pendingLabel = `Ha agenda conectada em ${formatDateTime(input.nextActionAt)}.`;
    }

    return {
        lastInteractionLabel: input.lastInteractionAt ? formatDateTime(input.lastInteractionAt) : "Sem interacao recente consolidada",
        pendingLabel,
        nextBestActionLabel: input.recommendations[0]?.title ?? input.nextAction ?? "Validar proximo passo operacional",
    };
}

export function buildCrmRecordQuickActions(input: {
    orgSlug: string;
    conversationId: string | null;
    nextAction: string;
    nextActionAt: string | null;
    recommendations: CrmRecommendedAction[];
    proposalPublicSlug?: string | null;
    proposalStatus?: string;
    hasDeal: boolean;
    hasUpcomingMeeting?: boolean;
    negotiationBlocker?: string | null;
}): CrmRecordQuickAction[] {
    const actions: CrmRecordQuickAction[] = [];

    if (input.conversationId) {
        actions.push({
            id: "open-conversation",
            label: "Abrir conversa vinculada",
            description: "Continua o atendimento no WhatsApp CRM existente.",
            tone: "warning",
            kind: "link",
            href: `/org/${input.orgSlug}/admin/whatsapp?conversationId=${input.conversationId}`,
        });
    }

    if (input.nextAction) {
        actions.push({
            id: "persist-next-action",
            label: "Registrar follow-up",
            description: `Salva "${input.nextAction}" como proxima acao explicita do record.`,
            tone: "positive",
            kind: "inline-update",
            field: "workspace.nextAction",
            value: input.nextAction,
        });
    }

    if (input.nextActionAt) {
        actions.push({
            id: "persist-next-action-at",
            label: "Marcar proxima acao",
            description: `Fixa ${formatDateTime(input.nextActionAt)} como marco operacional do registro.`,
            tone: "positive",
            kind: "inline-update",
            field: "workspace.nextActionAt",
            value: input.nextActionAt,
        });
    }

    if (input.recommendations[0]) {
        actions.push({
            id: `playbook:${input.recommendations[0].playbookId}`,
            label: input.recommendations[0].actionLabel,
            description: input.recommendations[0].reason,
            tone: "warning",
            kind: "playbook",
            playbookId: input.recommendations[0].playbookId,
        });
    }

    if (input.negotiationBlocker) {
        actions.push({
            id: "resume-negotiation",
            label: "Retomar negociacao",
            description: `Desbloquear: ${input.negotiationBlocker}.`,
            tone: "warning",
            kind: "playbook",
            playbookId: "resume-negotiation",
        });
        actions.push({
            id: "schedule-new-conversation",
            label: "Agendar call",
            description: "Propor uma conversa curta para alinhar.",
            tone: "neutral",
            kind: "playbook",
            playbookId: "schedule-new-conversation",
        });
        actions.push({
            id: "log-loss",
            label: "Registrar perda",
            description: "Encerra o ciclo de vendas.",
            tone: "critical",
            kind: "playbook",
            playbookId: "log-loss",
        });
    }

    if (input.hasUpcomingMeeting) {
        actions.push({
            id: "prepare-meeting",
            label: "Preparar reuniao",
            description: "Roteiro e contexto comercial antes da call.",
            tone: "neutral",
            kind: "playbook",
            playbookId: "prepare-meeting",
        });
        actions.push({
            id: "confirm-meeting",
            label: "Confirmar reuniao",
            description: "Envio de material ou confirmacao de pauta via WhatsApp.",
            tone: "neutral",
            kind: "playbook",
            playbookId: "confirm-meeting",
        });
        actions.push({
            id: "log-meeting-result",
            label: "Registrar resultado",
            description: "Define status e prox passo pos call na InovaCortex.",
            tone: "positive",
            kind: "playbook",
            playbookId: "log-meeting-result",
        });
    }

    if (input.proposalStatus && ["sent", "viewed", "stalled"].includes(input.proposalStatus)) {
        actions.push({
            id: "register-response",
            label: "Registrar resposta",
            description: "Marcar contato e atualizar proxima acao depois de resposta do cliente.",
            tone: "positive",
            kind: "inline-update",
            field: "workspace.nextAction",
            value: "Registrar resposta e definir proximo passo",
        });
        actions.push({
            id: "follow-up",
            label: "Cobrar proposta",
            description: "Abre o playbook para retomar a proposta atual.",
            tone: "warning",
            kind: "playbook",
            playbookId: "revive-stalled-proposal",
        });
        actions.push({
            id: "mark-stalled",
            label: "Marcar como stalled",
            description: "Atualiza status da proposta para stalled.",
            tone: "warning",
            kind: "inline-update",
            field: "proposal.status",
            value: "stalled",
        });
        actions.push({
            id: "mark-won",
            label: "Marcar como won",
            description: "Atualiza status da proposta para won.",
            tone: "positive",
            kind: "inline-update",
            field: "proposal.status",
            value: "won",
        });
        actions.push({
            id: "mark-lost",
            label: "Marcar como lost",
            description: "Atualiza status da proposta para lost.",
            tone: "critical",
            kind: "inline-update",
            field: "proposal.status",
            value: "lost",
        });
    }

    if (input.proposalPublicSlug) {
        actions.push({
            id: "open-proposal",
            label: "Abrir proposta",
            description: "Abre a proposta publica vinculada a este registro.",
            tone: "neutral",
            kind: "link",
            href: `/org/${input.orgSlug}/proposta/${input.proposalPublicSlug}`,
        });
    } else if (input.hasDeal) {
        actions.push({
            id: "open-deal-flow",
            label: "Abrir deal flow",
            description: "Leva o operador para o fluxo comercial canonico.",
            tone: "neutral",
            kind: "link",
            href: `/org/${input.orgSlug}/admin/deals`,
        });
    }

    return actions.slice(0, 15);
}

type StoredCrmSavedView = {
    id: string;
    name: string;
    scope: CrmViewScope;
    baseViewId: CrmViewId;
    defaultMode: CrmViewMode;
    sortId: CrmViewSortId;
    columnIds: string[];
    createdAt: string;
    updatedAt: string;
};

function buildSavedViewsSettingKey(scope: CrmViewScope, userId?: string) {
    return scope === "tenant"
        ? `${CRM_SAVED_VIEWS_KEY_PREFIX}.tenant`
        : `${CRM_SAVED_VIEWS_KEY_PREFIX}.user.${userId}`;
}

function parseStoredCrmSavedViews(value: string | null | undefined): StoredCrmSavedView[] {
    if (!value || !value.trim()) return [];

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter((item) => item && typeof item === "object")
            .map((item) => item as Partial<StoredCrmSavedView>)
            .filter((item) => (
                typeof item.id === "string"
                && typeof item.name === "string"
                && typeof item.baseViewId === "string"
                && typeof item.defaultMode === "string"
                && typeof item.sortId === "string"
                && Array.isArray(item.columnIds)
            ))
            .map((item) => ({
                id: normalizeSavedViewId(item.id!),
                name: item.name!,
                scope: item.scope === "tenant" ? "tenant" : "user",
                baseViewId: item.baseViewId as CrmViewId,
                defaultMode: item.defaultMode as CrmViewMode,
                sortId: item.sortId as CrmViewSortId,
                columnIds: item.columnIds!.map((columnId) => String(columnId)),
                createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
                updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
            }));
    } catch {
        return [];
    }
}

function serializeStoredCrmSavedViews(views: StoredCrmSavedView[]) {
    return JSON.stringify(views);
}

function materializeCrmSavedView(view: StoredCrmSavedView): CrmWorkspaceViewPreset {
    return {
        id: normalizeSavedViewId(view.id),
        kind: "saved",
        baseViewId: view.baseViewId,
        label: view.name,
        description: view.scope === "tenant"
            ? "View salva para o tenant a partir de um preset controlado."
            : "View salva do usuario a partir de um preset controlado.",
        columnIds: Array.from(new Set(view.columnIds)),
        defaultMode: view.defaultMode,
        sortId: view.sortId,
        scope: view.scope,
        createdAt: view.createdAt,
    };
}

function daysSince(value: string | Date) {
    const timestamp = new Date(value).getTime();
    return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

function resolvePriorityTone(priority: string): CrmTone {
    if (priority === "critical") return "critical";
    if (priority === "high") return "warning";
    if (priority === "low") return "positive";
    return "neutral";
}

export function deriveOperationalPriority(input: {
    explicitPriority: string | null;
    unreadCount: number;
    proposalStatus: string;
    hasUpcomingMeeting: boolean;
}): string {
    if (input.explicitPriority && PRIORITY_OPTIONS.some((option) => option.value === input.explicitPriority)) {
        return input.explicitPriority;
    }

    if (input.unreadCount > 0) return "high";
    if (input.proposalStatus === "sent") return "high";
    if (input.hasUpcomingMeeting) return "medium";
    return "medium";
}

export function deriveNextAction(input: {
    explicitNextAction: string;
    unreadCount: number;
    proposalStatus: string;
    hasDeal: boolean;
    hasUpcomingMeeting: boolean;
}): string {
    if (input.explicitNextAction) return input.explicitNextAction;
    if (input.unreadCount > 0) return "Responder conversa pendente";
    if (input.proposalStatus === "sent") return "Fazer follow-up da proposta";
    if (input.hasUpcomingMeeting) return "Confirmar reuniao";
    if (!input.hasDeal) return "Qualificar lead";
    return "Definir proximo passo comercial";
}

function resolveEditableExtensionField(field: CrmEditableField): FieldCatalogKey | null {
    switch (field) {
        case "assessment.segment":
            return "segment";
        case "assessment.urgency":
            return "urgency";
        case "assessment.goal":
            return "goal";
        default:
            if (field.startsWith("workspace.niche.")) {
                return field.replace("workspace.niche.", "") as FieldCatalogKey;
            }
            return null;
    }
}

function deriveViewIds(input: {
    needsAttention: boolean;
    proposalStatus: string;
    hasUpcomingMeeting: boolean;
    hasDeal: boolean;
    lastTouchAt: string;
    priority: string;
    isRevenueRisk?: boolean;
}): CrmViewId[] {
    const viewIds: CrmViewId[] = ["all"];

    if (input.needsAttention) viewIds.push("follow-up");
    if (["sent", "viewed"].includes(input.proposalStatus)) viewIds.push("stalled-proposals");
    if (input.hasUpcomingMeeting) viewIds.push("meetings");
    if (input.hasDeal) viewIds.push("pipeline");
    if (daysSince(input.lastTouchAt) >= 5) viewIds.push("quiet-window");
    if (input.proposalStatus !== "none") viewIds.push("proposals");

    const riskCandidate = input.isRevenueRisk
        || ["sent", "viewed"].includes(input.proposalStatus)
        || input.priority === "critical"
        || input.priority === "high";

    if (riskCandidate) viewIds.push("revenue-risk");
    if (input.proposalStatus !== "none") viewIds.push("proposals");

    return viewIds;
}

function deriveBoardColumnByView(input: {
    priority: string;
    proposalStatus: string;
    lastTouchAt: string;
    nextMeetingAt: string | null;
    stageId: string | null;
}): Partial<Record<CrmViewId, string>> {
    const quietDays = daysSince(input.lastTouchAt);
    const nextMeetingAt = input.nextMeetingAt ? new Date(input.nextMeetingAt) : null;
    const hoursToMeeting = nextMeetingAt
        ? (nextMeetingAt.getTime() - Date.now()) / (1000 * 60 * 60)
        : null;

    return {
        all: input.stageId || "no-deal",
        pipeline: input.stageId || "no-deal",
        "follow-up": input.priority,
        "stalled-proposals": input.proposalStatus === "viewed"
            ? "viewed"
            : input.proposalStatus === "sent"
                ? "sent"
                : "other",
        "quiet-window": quietDays >= 15
            ? "idle-15-plus"
            : quietDays >= 8
                ? "idle-8-14"
                : "idle-5-7",
        meetings: hoursToMeeting !== null && hoursToMeeting <= 24
            ? "meetings-today"
            : hoursToMeeting !== null && hoursToMeeting <= 48
                ? "meetings-48h"
                : "meetings-later",
        proposals: input.proposalStatus === "draft"
            ? "draft"
            : input.proposalStatus === "sent"
                ? "sent"
                : input.proposalStatus === "viewed"
                    ? "viewed"
                    : input.proposalStatus === "stalled"
                        ? "stalled"
                        : input.proposalStatus === "won"
                            ? "won"
                            : input.proposalStatus === "lost"
                                ? "lost"
                                : "other",
    };
}

export function buildCrmBoardColumns(records: CrmWorkspaceRecord[], stages: CrmFieldOption[]): CrmBoardColumn[] {
    return [
        {
            id: "no-deal",
            label: "Sem deal",
            description: `${records.filter((record) => record.boardColumnId === "no-deal").length} registros ainda sem oportunidade canonica`,
            tone: "neutral",
        },
        ...stages.map((stage) => {
            const count = records.filter((record) => record.boardColumnId === stage.value).length;
            return {
                id: stage.value,
                label: stage.label,
                description: `${count} registro${count === 1 ? "" : "s"} no stage ${stage.label}`,
                tone: (count > 0 ? "positive" : "neutral") as CrmTone,
            };
        }),
    ];
}

function buildContextualBoardColumns(viewId: CrmViewId, records: CrmWorkspaceRecord[]): CrmBoardColumn[] {
    if (viewId === "follow-up") {
        return PRIORITY_OPTIONS.map((option) => {
            const count = records.filter((record) => (record.boardColumnByView["follow-up"] ?? record.priority) === option.value).length;
            return {
                id: option.value,
                label: option.label,
                description: `${count} registro${count === 1 ? "" : "s"} com prioridade ${option.label.toLowerCase()}`,
                tone: resolvePriorityTone(option.value),
            };
        });
    }

    if (viewId === "quiet-window") {
        const quietColumns: Array<{ id: string; label: string; min: number; max?: number; tone: CrmTone }> = [
            { id: "idle-5-7", label: "5-7 dias", min: 5, max: 7, tone: "warning" },
            { id: "idle-8-14", label: "8-14 dias", min: 8, max: 14, tone: "critical" },
            { id: "idle-15-plus", label: "15+ dias", min: 15, tone: "critical" },
        ];

        return quietColumns.map((column) => {
            const count = records.filter((record) => {
                const days = daysSince(record.lastTouchAt);
                return days >= column.min && (typeof column.max === "undefined" || days <= column.max);
            }).length;

            return {
                id: column.id,
                label: column.label,
                description: `${count} registro${count === 1 ? "" : "s"} sem resposta nessa janela`,
                tone: column.tone,
            };
        });
    }

    if (viewId === "revenue-risk") {
        const riskBuckets = [
            { id: "highest", label: "Risco alto", tone: "critical" as CrmTone, filter: (record: CrmWorkspaceRecord) => record.priority === "critical" || record.proposalStatus === "sent" || record.proposalStatus === "viewed" },
            { id: "high", label: "Risco elevado", tone: "warning" as CrmTone, filter: (record: CrmWorkspaceRecord) => record.priority === "high" || (record.proposalStatus === "none" && daysSince(record.lastTouchAt) >= 7) },
            { id: "medium", label: "Risco medio", tone: "warning" as CrmTone, filter: (record: CrmWorkspaceRecord) => record.priority === "medium" },
            { id: "low", label: "Risco baixo", tone: "neutral" as CrmTone, filter: (record: CrmWorkspaceRecord) => record.priority === "low" },
        ];

        return riskBuckets.map((bucket) => {
            const count = records.filter(bucket.filter).length;
            return {
                id: bucket.id,
                label: bucket.label,
                description: `${count} registro${count === 1 ? "" : "s"} em ${bucket.label.toLowerCase()}`,
                tone: bucket.tone,
            };
        });
    }

    if (viewId === "proposals") {
        const statusBuckets = [
            { id: "draft", label: "Draft", tone: "neutral" as CrmTone, filter: (record: CrmWorkspaceRecord) => record.proposalStatus === "draft" },
            { id: "sent", label: "Sent", tone: "warning" as CrmTone, filter: (record: CrmWorkspaceRecord) => record.proposalStatus === "sent" },
            { id: "viewed", label: "Viewed", tone: "warning" as CrmTone, filter: (record: CrmWorkspaceRecord) => record.proposalStatus === "viewed" },
            { id: "stalled", label: "Stalled", tone: "critical" as CrmTone, filter: (record: CrmWorkspaceRecord) => record.proposalStatus === "stalled" },
            { id: "won", label: "Won", tone: "positive" as CrmTone, filter: (record: CrmWorkspaceRecord) => record.proposalStatus === "won" },
            { id: "lost", label: "Lost", tone: "neutral" as CrmTone, filter: (record: CrmWorkspaceRecord) => record.proposalStatus === "lost" },
            { id: "others", label: "Outros", tone: "neutral" as CrmTone, filter: (record: CrmWorkspaceRecord) => !["draft", "sent", "viewed", "stalled", "won", "lost"].includes(record.proposalStatus) },
        ];

        return statusBuckets.map((bucket) => {
            const count = records.filter(bucket.filter).length;
            return {
                id: bucket.id,
                label: bucket.label,
                description: `${count} proposta${count === 1 ? "" : "s"} em ${bucket.label.toLowerCase()}`,
                tone: bucket.tone,
            };
        });
    }

    if (viewId === "meetings") {
        const meetingColumns = [
            { id: "meetings-today", label: "Hoje", description: "Reunioes no mesmo dia", tone: "positive" as CrmTone },
            { id: "meetings-48h", label: "48h", description: "Reunioes no curtissimo prazo", tone: "warning" as CrmTone },
            { id: "meetings-later", label: "Depois", description: "Agenda futura que precisa de preparo", tone: "neutral" as CrmTone },
        ];

        return meetingColumns.map((column) => ({
            ...column,
            description: `${records.filter((record) => record.boardColumnByView["meetings"] === column.id).length} registro${records.filter((record) => record.boardColumnByView["meetings"] === column.id).length === 1 ? "" : "s"} ${column.description.toLowerCase()}`,
        }));
    }

    if (viewId === "stalled-proposals") {
        const proposalColumns = [
            { id: "sent", label: "Enviadas", tone: "warning" as CrmTone },
            { id: "viewed", label: "Visualizadas", tone: "critical" as CrmTone },
            { id: "other", label: "Outras", tone: "neutral" as CrmTone },
        ];

        return proposalColumns.map((column) => {
            const count = records.filter((record) => record.boardColumnByView["stalled-proposals"] === column.id).length;
            return {
                id: column.id,
                label: column.label,
                description: `${count} proposta${count === 1 ? "" : "s"} nessa situacao`,
                tone: column.tone,
            };
        });
    }

    return [];
}

function buildBoardColumnsByView(records: CrmWorkspaceRecord[], stages: CrmFieldOption[]): Record<CrmViewId, CrmBoardColumn[]> {
    return {
        all: buildCrmBoardColumns(records, stages),
        "follow-up": buildContextualBoardColumns("follow-up", records),
        "stalled-proposals": buildContextualBoardColumns("stalled-proposals", records),
        "quiet-window": buildContextualBoardColumns("quiet-window", records),
        meetings: buildContextualBoardColumns("meetings", records),
        pipeline: buildCrmBoardColumns(records, stages),
        "revenue-risk": buildContextualBoardColumns("revenue-risk", records),
        proposals: buildContextualBoardColumns("proposals", records),
    };
}

export function applyCrmInlinePatch(
    records: CrmWorkspaceRecord[],
    patch: { assessmentId: string; field: CrmEditableField; value: string; stageLabel?: string | null; ownerLabel?: string | null; nextActionAtLabel?: string | null },
): CrmWorkspaceRecord[] {
    return records.map((record) => {
        if (record.id !== patch.assessmentId) return record;
        if (patch.field === "assessment.status") return { ...record, status: patch.value };
        if (patch.field === "contact.lifecycle") return { ...record, contactLifecycle: patch.value };
        if (patch.field === "conversation.assignedUserId") return { ...record, ownerUserId: patch.value || null, ownerLabel: patch.ownerLabel ?? "Sem responsavel" };
        if (patch.field === "workspace.priority") {
            return {
                ...record,
                priority: patch.value,
                tone: resolvePriorityTone(patch.value),
                boardColumnByView: {
                    ...record.boardColumnByView,
                    "follow-up": patch.value,
                },
            };
        }
        if (patch.field === "workspace.nextAction") return { ...record, nextAction: patch.value };
        if (patch.field === "workspace.nextActionAt") return { ...record, nextActionAt: patch.value || null, nextActionAtLabel: patch.nextActionAtLabel ?? (patch.value || "-") };
        if (patch.field === "proposal.status") {
            const status = patch.value;
            return {
                ...record,
                proposalStatus: status,
                proposalLabel: PROPOSAL_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? record.proposalLabel,
                needsAttention: ["sent", "viewed", "stalled"].includes(status),
                tone: resolveTone({ unreadCount: record.unreadCount, proposalStatus: status, nextMeetingLabel: record.nextMeetingLabel, activityCount: record.activityCount }),
                viewIds: Array.from(new Set([...record.viewIds, ...resolveViewIdsForProposalStatus(status)])),
            };
        }
        const extensionField = resolveEditableExtensionField(patch.field);
        if (extensionField) {
            return {
                ...record,
                extensionValues: {
                    ...record.extensionValues,
                    [extensionField]: patch.value,
                },
            };
        }
        return {
            ...record,
            dealStageId: patch.value,
            dealStageLabel: patch.stageLabel ?? record.dealStageLabel,
            boardColumnId: buildBoardColumnId(patch.value),
            boardColumnByView: {
                ...record.boardColumnByView,
                all: buildBoardColumnId(patch.value),
                pipeline: buildBoardColumnId(patch.value),
            },
            hasDeal: true,
        };
    });
}

export function buildOperatorCrmWorkspaceModel(input: OperatorCrmWorkspaceInput): OperatorCrmWorkspaceModel {
    const niche = resolveCrmNicheDefinition(input.industry);
    const tableColumns = buildWorkspaceColumns(niche, input.stageOptions, input.ownerOptions);
    const systemViews = buildViewPresets(niche);
    const savedViews = (input.savedViews ?? []).map((view) => ({
        ...view,
        id: normalizeSavedViewId(view.id),
        kind: "saved" as const,
    }));
    const revenueSignals = input.revenueSignals;
    const enrichedRecords = input.records.map((record) => {
        const derivedIds = deriveViewIds({
            needsAttention: record.needsAttention,
            proposalStatus: record.proposalStatus,
            hasUpcomingMeeting: record.nextMeetingLabel !== "Sem agenda",
            hasDeal: record.hasDeal,
            lastTouchAt: record.lastTouchAt,
            priority: record.priority,
            isRevenueRisk: record.viewIds.includes("revenue-risk"),
        });

        const resolvedIds = Array.from(new Set([...record.viewIds, ...derivedIds]));

        const revenueRiskBoard = record.priority === "critical"
            ? "critical"
            : record.priority === "high"
                ? "high"
                : record.priority;

        return {
            ...record,
            viewIds: resolvedIds,
            boardColumnByView: {
                ...record.boardColumnByView,
                "revenue-risk": revenueRiskBoard,
            },
        };
    });
    const attentionCount = enrichedRecords.filter((record) => record.viewIds.includes("follow-up")).length;
    const activePipelineCount = enrichedRecords.filter((record) => record.dealStageId).length;
    const warnings: string[] = [];

    if (input.records.length === 0) warnings.push("Ainda nao ha registros suficientes para densidade total no CRM workspace.");
    if (input.stageOptions.length === 0) warnings.push("O tenant ainda nao tem stages canonicos suficientes; o board usa fallback seguro.");
    if (niche.key === "general") warnings.push(`Nao existe schema vertical controlado para "${input.industry}" ainda; o workspace usa fallback adaptativo seguro.`);

    return {
        generatedAt: new Date().toISOString(),
        orgSlug: input.orgSlug,
        orgName: input.orgName,
        industry: input.industry,
        summary: {
            headline: `CRM workspace de ${input.orgName}`,
            subheadline: "Workspace operacional editavel para operar conta, contato, deal e proposta sem quebrar o dominio canonico.",
            metrics: [
                { id: "records", label: "Registros vivos", value: String(input.records.length), detail: "assessment anchor com contato/deal/proposta conectados", tone: input.records.length > 0 ? "positive" : "neutral" },
                { id: "attention", label: "Precisam de toque", value: String(attentionCount), detail: "unread, proposta em risco ou baixa atividade", tone: attentionCount > 0 ? "warning" : "positive" },
                { id: "pipeline", label: "Pipeline canonico", value: String(activePipelineCount), detail: "registros ja promovidos para deal", tone: activePipelineCount > 0 ? "positive" : "neutral" },
                { id: "open-revenue", label: "Receita em aberto", value: formatCurrencyBRL((revenueSignals?.estimatedOpenRevenueCents ?? 0) / 100), detail: "valor estimado do pipeline aberto com base em propostas e deals ativos", tone: (revenueSignals?.estimatedOpenRevenueCents ?? 0) > 0 ? "neutral" : "warning" },
                { id: "revenue-risk", label: "Receita em risco", value: formatCurrencyBRL((revenueSignals?.estimatedRevenueAtRiskCents ?? 0) / 100), detail: `${revenueSignals?.stalledProposals.count ?? 0} propostas paradas e ${revenueSignals?.inactiveDeals.count ?? 0} deals sem avanco`, tone: (revenueSignals?.estimatedRevenueAtRiskCents ?? 0) > 0 ? "warning" : "positive" },
                { id: "proposals", label: "Propostas abertas", value: String(input.records.filter((record) => ["sent", "viewed", "stalled"].includes(record.proposalStatus)).length), detail: "propostas em estado operacional crítico ou de acompanhamento", tone: input.records.filter((record) => ["sent", "viewed", "stalled"].includes(record.proposalStatus)).length > 0 ? "warning" : "positive" },
                { id: "niche", label: "Nicho ativo", value: niche.label, detail: "schema controlado para campos e secoes adicionais", tone: "neutral" },
            ],
            focus: [
                attentionCount > 0 ? `Atacar ${attentionCount} registros com sinal de risco antes de abrir novas frentes.` : "Fila comercial controlada; o workspace pode operar por rotina e qualidade de toque.",
                revenueSignals?.topAtRiskOpportunities[0]
                    ? `${revenueSignals.topAtRiskOpportunities[0].company}: ${revenueSignals.topAtRiskOpportunities[0].recommendedAction}`
                    : revenueSignals?.summary.focus ?? "Sem sinal forte de receita em risco fora da rotina normal.",
                activePipelineCount > 0 ? `Usar board e table em conjunto para mover ${activePipelineCount} deals sem perder contexto 360.` : "Comecar pela table para qualificar contatos antes de puxar deals novos.",
            ],
        },
        niche: {
            key: niche.key,
            label: niche.label,
            description: niche.description,
            tableFieldIds: niche.tableFieldIds,
            editableFieldIds: niche.editableFieldIds,
            detailSections: niche.detailSections,
        },
        views: {
            defaultViewId: "all",
            presets: [...systemViews, ...savedViews],
            saved: savedViews,
            system: systemViews,
            sortOptions: CRM_VIEW_SORT_OPTIONS,
            saveScopes: CRM_SAVE_SCOPE_OPTIONS,
        },
        table: { columns: tableColumns, records: enrichedRecords },
        board: {
            columns: buildCrmBoardColumns(enrichedRecords, input.stageOptions),
            columnsByView: buildBoardColumnsByView(enrichedRecords, input.stageOptions),
        },
        editable: {
            assessmentStatus: ASSESSMENT_STATUS_OPTIONS,
            contactLifecycle: CONTACT_LIFECYCLE_OPTIONS,
            dealStage: input.stageOptions,
            owner: input.ownerOptions,
            priority: PRIORITY_OPTIONS,
            detailEditors: buildDetailEditorDefinitions(niche, input.stageOptions, input.ownerOptions),
            bulkActions: buildBulkActionDefinitions(input.stageOptions, input.ownerOptions),
        },
        shortcuts: {
            byView: buildWorkflowShortcuts(),
            selectionLimit: CRM_BULK_ACTION_LIMIT,
        },
        automation: {
            cadenceTemplates: CRM_CADENCE_TEMPLATES,
            playbooksByView: buildPlaybooksByView(),
        },
        filters: { quick: QUICK_FILTERS },
        warnings,
    };
}

function deriveLastTouch(raw: {
    assessmentCreatedAt: Date;
    contactLastMessageAt: Date | null;
    proposalUpdatedAt: Date | null;
    activityCreatedAt: Date | null;
}): { at: string; label: string } {
    const latest = [
        raw.contactLastMessageAt,
        raw.proposalUpdatedAt,
        raw.activityCreatedAt,
        raw.assessmentCreatedAt,
    ]
        .filter(Boolean)
        .sort((left, right) => new Date(right as Date).getTime() - new Date(left as Date).getTime())[0] as Date;

    return {
        at: latest.toISOString(),
        label: formatDateTime(latest),
    };
}

function buildStageOptions(stageRows: Array<{ id: string; name: string; pipeline: { name: string } | null }>): CrmFieldOption[] {
    return stageRows.map((stage) => ({
        value: stage.id,
        label: stage.pipeline?.name && stage.pipeline.name !== "CRM Principal"
            ? `${stage.pipeline.name} · ${stage.name}`
            : stage.name,
    }));
}

export async function listCrmSavedViews(input: {
    organizationId: string;
    userId?: string;
}): Promise<CrmWorkspaceViewPreset[]> {
    const keys = [
        buildSavedViewsSettingKey("tenant"),
        input.userId ? buildSavedViewsSettingKey("user", input.userId) : null,
    ].filter(Boolean) as string[];

    if (keys.length === 0) return [];

    const rows = await (prisma as any).systemSetting.findMany({
        where: {
            organizationId: input.organizationId,
            key: { in: keys },
        },
        select: {
            value: true,
        },
    });

    const storedViews: StoredCrmSavedView[] = rows.flatMap((row: { value: string }) => parseStoredCrmSavedViews(row.value));

    return storedViews
        .sort((left: StoredCrmSavedView, right: StoredCrmSavedView) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .map((view: StoredCrmSavedView) => materializeCrmSavedView(view));
}

export async function saveCrmSavedView(input: SaveCrmSavedViewInput): Promise<SaveCrmSavedViewResult> {
    assertRole(input.role, input.scope === "tenant" ? "admin" : "viewer");
    if (input.scope === "user" && !input.userId) {
        throw new Error("FORBIDDEN: requires user scope owner");
    }

    const key = buildSavedViewsSettingKey(input.scope, input.userId);
    const existing = await (prisma as any).systemSetting.findUnique({
        where: {
            key_organizationId: {
                key,
                organizationId: input.organizationId,
            },
        },
        select: {
            value: true,
        },
    });

    const now = new Date().toISOString();
    const storedView: StoredCrmSavedView = {
        id: normalizeSavedViewId(`${Date.now()}`),
        name: input.name,
        scope: input.scope,
        baseViewId: input.baseViewId,
        defaultMode: input.defaultMode,
        sortId: input.sortId,
        columnIds: Array.from(new Set(input.columnIds)),
        createdAt: now,
        updatedAt: now,
    };
    const nextViews = [...parseStoredCrmSavedViews(existing?.value ?? null), storedView];

    await (prisma as any).systemSetting.upsert({
        where: {
            key_organizationId: {
                key,
                organizationId: input.organizationId,
            },
        },
        create: {
            key,
            organizationId: input.organizationId,
            value: serializeStoredCrmSavedViews(nextViews),
        },
        update: {
            value: serializeStoredCrmSavedViews(nextViews),
        },
    });

    return {
        view: materializeCrmSavedView(storedView),
    };
}

export async function buildOperatorCrmWorkspace(orgId: string, orgSlug: string, userId?: string): Promise<OperatorCrmWorkspaceModel> {
    const db = prisma as any;
    const [organization, stageRows, userRows, assessmentRows, savedViews, revenueSignals] = await Promise.all([
        db.organization.findUnique({
            where: { id: orgId },
            select: { name: true, industry: true },
        }),
        db.pipelineStage.findMany({
            where: { pipeline: { organizationId: orgId } },
            orderBy: [{ pipeline: { position: "asc" } }, { position: "asc" }],
            select: { id: true, name: true, pipeline: { select: { name: true } } },
        }),
        db.user.findMany({
            where: { organizationId: orgId },
            orderBy: { email: "asc" },
            select: {
                id: true,
                email: true,
            },
        }),
        db.assessment.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
            take: 80,
            select: {
                id: true,
                createdAt: true,
                name: true,
                email: true,
                phone: true,
                company: true,
                segment: true,
                teamSize: true,
                volumeDay: true,
                urgency: true,
                goal: true,
                status: true,
                scoreTotal: true,
                classification: true,
                internalNotes: true,
                roiProjection: {
                    select: {
                        monthlyHoursRecovered: true,
                        estimatedPaybackMonths: true,
                    },
                },
                contact: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumberE164: true,
                        lifecycle: true,
                        tags: true,
                        lastMessageAt: true,
                        conversations: {
                            orderBy: { lastMessageAt: "desc" },
                            take: 1,
                            select: {
                                id: true,
                                assignedUserId: true,
                                unreadCount: true,
                                lastMessagePreview: true,
                                lastMessageAt: true,
                                user: {
                                    select: {
                                        email: true,
                                    },
                                },
                            },
                        },
                        emailThreads: {
                            orderBy: { lastMessageAt: "desc" },
                            take: 1,
                            select: {
                                id: true,
                                assignedUserId: true,
                                unreadCount: true,
                                lastMessagePreview: true,
                                lastMessageAt: true,
                                user: {
                                    select: {
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                },
                deal: {
                    select: {
                        id: true,
                        stageId: true,
                        stage: {
                            select: {
                                name: true,
                            },
                        },
                        activities: {
                            orderBy: { createdAt: "desc" },
                            take: 1,
                            select: { createdAt: true },
                        },
                        _count: {
                            select: { activities: true },
                        },
                    },
                },
                proposals: {
                    orderBy: { updatedAt: "desc" },
                    take: 1,
                    select: {
                        id: true,
                        status: true,
                        version: true,
                        pricingEstimate: true,
                        updatedAt: true,
                    },
                },
            },
        }),
        listCrmSavedViews({
            organizationId: orgId,
            userId,
        }),
        buildTenantRevenueSignals(orgId),
    ]);

    const assessmentIds = (assessmentRows as Array<{ id: string }>).map((assessment) => assessment.id);
    const meetingRows = assessmentIds.length > 0
        ? await db.meetingSession.findMany({
            where: {
                organizationId: orgId,
                assessmentId: { in: assessmentIds },
                status: { in: ["scheduled", "confirmed", "rescheduled", "active", "pending"] },
            },
            orderBy: { startAt: "asc" },
            select: {
                id: true,
                assessmentId: true,
                startAt: true,
                leadEmail: true,
            },
        })
        : [];

    const nextMeetingByAssessment = new Map<string, { id: string; startAt: Date; leadEmail: string | null }>();
    for (const meeting of meetingRows as Array<{ id: string; assessmentId: string; startAt: Date; leadEmail: string | null }>) {
        if (nextMeetingByAssessment.has(meeting.assessmentId)) continue;
        nextMeetingByAssessment.set(meeting.assessmentId, meeting);
    }

    const niche = resolveCrmNicheDefinition(organization?.industry ?? "Services");
    const workspaceFieldIds = collectWorkspaceFieldIds(niche);
    const ownerOptions: CrmFieldOption[] = [
        { value: "", label: "Sem responsavel" },
        ...(userRows as Array<{ id: string; email: string }>).map((user) => ({
            value: user.id,
            label: user.email,
        })),
    ];
    const records: CrmWorkspaceRecord[] = (assessmentRows as Array<any>).map((assessment) => {
        const workspaceMetadata = parseWorkspaceMetadata(assessment.internalNotes);
        const internalContext = workspaceMetadata.root;
        const roiContext = assessment.roiProjection ?? {};
        const latestProposal = assessment.proposals[0] ?? null;
        const latestWhatsApp = assessment.contact?.conversations?.[0] ?? null;
        const latestEmail = assessment.contact?.emailThreads?.[0] ?? null;
        let latestConversation = latestWhatsApp;
        if (latestEmail) {
            if (!latestWhatsApp) {
                latestConversation = latestEmail;
            } else {
                const waTime = latestWhatsApp.lastMessageAt ? new Date(latestWhatsApp.lastMessageAt).getTime() : 0;
                const emailTime = latestEmail.lastMessageAt ? new Date(latestEmail.lastMessageAt).getTime() : 0;
                if (emailTime > waTime) {
                    latestConversation = latestEmail;
                }
            }
        }
        const nextMeeting = nextMeetingByAssessment.get(assessment.id);
        const proposal = summarizeProposal(latestProposal);
        const lastTouch = deriveLastTouch({
            assessmentCreatedAt: assessment.createdAt,
            contactLastMessageAt: assessment.contact?.lastMessageAt ?? null,
            proposalUpdatedAt: latestProposal?.updatedAt ?? null,
            activityCreatedAt: assessment.deal?.activities?.[0]?.createdAt ?? null,
        });
        const extensionValues = Object.fromEntries(
            workspaceFieldIds.map((fieldId) => [fieldId, resolveExtensionValue(fieldId, {
                assessment: {
                    segment: assessment.segment,
                    teamSize: assessment.teamSize,
                    volumeDay: assessment.volumeDay,
                    urgency: assessment.urgency,
                    goal: assessment.goal,
                    classification: assessment.classification,
                    scoreTotal: assessment.scoreTotal,
                },
                internalContext,
                roi: roiContext,
                nicheValues: workspaceMetadata.nicheValues,
            })]),
        );
        const nextMeetingLabel = nextMeeting ? formatDateTime(nextMeeting.startAt) : "Sem agenda";
        const unreadCount = latestConversation?.unreadCount ?? 0;
        const activityCount = assessment.deal?._count?.activities ?? 0;
        const needsAttention = unreadCount > 0 || ["sent", "viewed"].includes(proposal.status) || activityCount === 0;
        const priority = deriveOperationalPriority({
            explicitPriority: workspaceMetadata.priority,
            unreadCount,
            proposalStatus: proposal.status,
            hasUpcomingMeeting: Boolean(nextMeeting),
        });
        const nextAction = deriveNextAction({
            explicitNextAction: workspaceMetadata.nextAction,
            unreadCount,
            proposalStatus: proposal.status,
            hasDeal: Boolean(assessment.deal?.id),
            hasUpcomingMeeting: Boolean(nextMeeting),
        });
        const nextActionAt = workspaceMetadata.nextActionAt ?? (nextMeeting ? nextMeeting.startAt.toISOString() : null);
        const cadenceLabel = formatCadenceLabel(workspaceMetadata.cadence);
        const ownerUserId = latestConversation?.assignedUserId ?? null;
        const ownerLabel = latestConversation?.user?.email ?? "Sem responsavel";
        const isRevenueRisk = ["sent", "viewed"].includes(proposal.status) || daysSince(lastTouch.at) >= 7;

        const viewIds = deriveViewIds({
            needsAttention,
            proposalStatus: proposal.status,
            hasUpcomingMeeting: Boolean(nextMeeting),
            hasDeal: Boolean(assessment.deal?.id),
            lastTouchAt: lastTouch.at,
            priority,
            isRevenueRisk,
        });
        const recommendations = buildRecommendedActions({
            cadence: workspaceMetadata.cadence,
            unreadCount,
            proposalStatus: proposal.status,
            hasUpcomingMeeting: Boolean(nextMeeting),
            hasDeal: Boolean(assessment.deal?.id),
            needsAttention,
        });

        return {
            id: assessment.id,
            company: assessment.company || "Lead sem empresa",
            primaryContact: assessment.contact?.name || assessment.name || "Contato sem nome",
            email: assessment.email || "-",
            phone: assessment.contact?.phoneNumberE164 || assessment.phone || "-",
            status: assessment.status || "Novo",
            contactLifecycle: assessment.contact?.lifecycle || "lead",
            dealStageId: assessment.deal?.stageId ?? null,
            dealStageLabel: deriveStageLabel(assessment.deal?.stage?.name),
            proposalStatus: proposal.status,
            proposalLabel: proposal.label,
            scoreLabel: `${assessment.scoreTotal ?? 0} · ${assessment.classification ?? "-"}`,
            lastTouchAt: lastTouch.at,
            lastTouchLabel: lastTouch.label,
            nextMeetingLabel,
            unreadCount,
            activityCount,
            tags: parseJsonArray(assessment.contact?.tags),
            tone: resolveTone({
                unreadCount,
                proposalStatus: proposal.status,
                nextMeetingLabel,
                activityCount,
            }),
            boardColumnId: buildBoardColumnId(assessment.deal?.stageId),
            boardColumnByView: deriveBoardColumnByView({
                priority,
                proposalStatus: proposal.status,
                lastTouchAt: lastTouch.at,
                nextMeetingAt: nextMeeting?.startAt?.toISOString?.() ?? null,
                stageId: assessment.deal?.stageId ?? null,
            }),
            conversationId: latestConversation?.id ?? null,
            ownerUserId,
            ownerLabel,
            priority,
            nextAction,
            nextActionAt,
            nextActionAtLabel: nextActionAt ? formatDateTime(nextActionAt) : "-",
            cadenceLabel,
            recommendedActionLabel: recommendations[0]?.title ?? "-",
            needsAttention,
            hasDeal: Boolean(assessment.deal?.id),
            hasConversation: Boolean(latestConversation?.id),
            viewIds,
            extensionValues,
        };
    });

    return buildOperatorCrmWorkspaceModel({
        orgSlug,
        orgName: organization?.name ?? orgSlug,
        industry: organization?.industry ?? "Services",
        records,
        stageOptions: buildStageOptions(stageRows as Array<any>),
        ownerOptions,
        savedViews,
        revenueSignals,
    });
}

function buildDetailSection(input: {
    id: string;
    title: string;
    description: string;
    values: Array<{ id: string; label: string; value: string; tone?: CrmTone }>;
}): CrmRecordDetailSection {
    return {
        id: input.id,
        title: input.title,
        description: input.description,
        items: input.values.filter((item) => item.value && item.value !== "-"),
    };
}

export async function buildOperatorCrmRecordDetail(input: {
    organizationId: string;
    orgSlug: string;
    assessmentId: string;
}): Promise<CrmRecordDetailModel | null> {
    const db = prisma as any;
    const [organization, assessment] = await Promise.all([
        db.organization.findUnique({
            where: { id: input.organizationId },
            select: { industry: true },
        }),
        db.assessment.findFirst({
            where: {
                id: input.assessmentId,
                organizationId: input.organizationId,
            },
            select: {
                id: true,
                createdAt: true,
                name: true,
                email: true,
                phone: true,
                company: true,
                segment: true,
                teamSize: true,
                volumeDay: true,
                urgency: true,
                goal: true,
                status: true,
                scoreTotal: true,
                classification: true,
                recommendedMissions: true,
                internalNotes: true,
                roiProjection: {
                    select: {
                        monthlyHoursRecovered: true,
                        estimatedPaybackMonths: true,
                    },
                },
                contact: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumberE164: true,
                        lifecycle: true,
                        tags: true,
                        optedOutAt: true,
                        wa_id: true,
                        lastMessageAt: true,
                        conversations: {
                            orderBy: { lastMessageAt: "desc" },
                            take: 1,
                            select: {
                                id: true,
                                assignedUserId: true,
                                unreadCount: true,
                                status: true,
                                lastMessageAt: true,
                                lastMessagePreview: true,
                                slaDueAt: true,
                                user: {
                                    select: {
                                        email: true,
                                    },
                                },
                            },
                        },
                        emailThreads: {
                            orderBy: { lastMessageAt: "desc" },
                            take: 1,
                            select: {
                                id: true,
                                assignedUserId: true,
                                unreadCount: true,
                                status: true,
                                lastMessageAt: true,
                                lastMessagePreview: true,
                                slaDueAt: true,
                                subject: true,
                                user: {
                                    select: {
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                },
                deal: {
                    select: {
                        id: true,
                        stageId: true,
                        stage: {
                            select: {
                                name: true,
                            },
                        },
                        activities: {
                            orderBy: { createdAt: "desc" },
                            take: 12,
                            select: {
                                id: true,
                                type: true,
                                note: true,
                                createdAt: true,
                            },
                        },
                    },
                },
                proposals: {
                    orderBy: { updatedAt: "desc" },
                    take: 10,
                    select: {
                        id: true,
                        status: true,
                        version: true,
                        publicSlug: true,
                        createdAt: true,
                        updatedAt: true,
                        pricingEstimate: true,
                    },
                },
            },
        }),
    ]);

    if (!assessment) return null;

    const [waMessages, emailMessages, meetings] = await Promise.all([
        assessment.contact?.id
            ? db.whatsAppMessage.findMany({
                where: {
                    organizationId: input.organizationId,
                    contactId: assessment.contact.id,
                },
                orderBy: { createdAt: "desc" },
                take: 12,
                select: {
                    id: true,
                    organizationId: true,
                    conversationId: true,
                    contactId: true,
                    messageId: true,
                    direction: true,
                    text: true,
                    type: true,
                    status: true,
                    sentAt: true,
                    deliveredAt: true,
                    readAt: true,
                    failedAt: true,
                    createdAt: true,
                },
            })
            : [],
        assessment.contact?.id
            ? db.emailMessage.findMany({
                where: {
                    organizationId: input.organizationId,
                    contactId: assessment.contact.id,
                },
                orderBy: { createdAt: "desc" },
                take: 12,
                select: {
                    id: true,
                    organizationId: true,
                    threadId: true,
                    contactId: true,
                    externalMessageId: true,
                    direction: true,
                    bodyText: true,
                    status: true,
                    sentAt: true,
                    receivedAt: true,
                    createdAt: true,
                },
            })
            : [],
        db.meetingSession.findMany({
            where: {
                organizationId: input.organizationId,
                assessmentId: assessment.id,
            },
            orderBy: { startAt: "asc" },
            take: 8,
            select: {
                id: true,
                status: true,
                startAt: true,
                leadEmail: true,
                recommendedCTA: true,
            },
        }).catch(() => []),
    ]);

    const niche = resolveCrmNicheDefinition(organization?.industry ?? "Services");
    const workspaceMetadata = parseWorkspaceMetadata(assessment.internalNotes);
    const internalContext = workspaceMetadata.root;
    const roiContext = assessment.roiProjection ?? {};
    const extensionContext = {
        assessment: {
            segment: assessment.segment,
            teamSize: assessment.teamSize,
            volumeDay: assessment.volumeDay,
            urgency: assessment.urgency,
            goal: assessment.goal,
            classification: assessment.classification,
            scoreTotal: assessment.scoreTotal,
        },
        internalContext,
        roi: roiContext,
        nicheValues: workspaceMetadata.nicheValues,
    };
    const latestWhatsApp = assessment.contact?.conversations?.[0] ?? null;
    const latestEmail = assessment.contact?.emailThreads?.[0] ?? null;
    let primaryConversation: any = latestWhatsApp;
    let primaryConversationChannel = "whatsapp";
    if (latestEmail) {
        if (!latestWhatsApp) {
            primaryConversation = latestEmail;
            primaryConversationChannel = "email";
        } else {
            const waTime = latestWhatsApp.lastMessageAt ? new Date(latestWhatsApp.lastMessageAt).getTime() : 0;
            const emailTime = latestEmail.lastMessageAt ? new Date(latestEmail.lastMessageAt).getTime() : 0;
            if (emailTime > waTime) {
                primaryConversation = latestEmail;
                primaryConversationChannel = "email";
            }
        }
    }

    const ownerUserId = primaryConversation?.assignedUserId ?? null;
    const ownerLabel = primaryConversation?.user?.email ?? "Sem responsavel";
    const priority = deriveOperationalPriority({
        explicitPriority: workspaceMetadata.priority,
        unreadCount: primaryConversation?.unreadCount ?? 0,
        proposalStatus: assessment.proposals[0]?.status ?? "none",
        hasUpcomingMeeting: meetings.length > 0,
    });
    const nextAction = deriveNextAction({
        explicitNextAction: workspaceMetadata.nextAction,
        unreadCount: primaryConversation?.unreadCount ?? 0,
        proposalStatus: assessment.proposals[0]?.status ?? "none",
        hasDeal: Boolean(assessment.deal?.id),
        hasUpcomingMeeting: meetings.length > 0,
    });
    const nextActionAt = workspaceMetadata.nextActionAt ?? ((meetings as Array<any>)[0]?.startAt?.toISOString?.() ?? null);
    const cadenceLabel = formatCadenceLabel(workspaceMetadata.cadence);
    const recommendations = buildRecommendedActions({
        cadence: workspaceMetadata.cadence,
        unreadCount: primaryConversation?.unreadCount ?? 0,
        proposalStatus: assessment.proposals[0]?.status ?? "none",
        hasUpcomingMeeting: meetings.length > 0,
        hasDeal: Boolean(assessment.deal?.id),
        needsAttention: (primaryConversation?.unreadCount ?? 0) > 0 || ["sent", "viewed"].includes(assessment.proposals[0]?.status ?? "none"),
    });

    const conversationAttention = primaryConversation
        ? resolveWhatsAppConversationAttention({
            status: primaryConversation.status,
            unreadCount: primaryConversation.unreadCount,
            slaDueAt: primaryConversation.slaDueAt,
            optedOutAt: assessment.contact?.optedOutAt,
        })
        : null;

    const allMessages = mergeCrmInboxFeedItems(
        (waMessages as Array<any>).map((m) => ({
            id: m.id,
            source: "whatsapp",
            direction: m.direction,
            text: m.text,
            statusLabel: resolveWhatsAppMessageLifecycleLabel(buildMessageSnapshot(m)),
            createdAt: m.createdAt,
        })),
        (emailMessages as Array<any>).map((m) => ({
            id: m.id,
            source: "email",
            direction: m.direction,
            text: m.bodyText || "Email sem corpo de texto",
            statusLabel: m.status === "received" ? "Recebido" : "Enviado",
            createdAt: m.createdAt,
        })),
    );

    const messageItems = allMessages.map((snapshot) => {
        return {
            id: snapshot.id,
            direction: snapshot.direction === "outbound" ? "outbound" : "inbound",
            text: snapshot.text || "Mensagem vazia",
            status: `${snapshot.source === "email" ? "✉️ " : "💬 "} ${snapshot.statusLabel}`,
            at: snapshot.createdAt.toISOString(),
        } satisfies CrmRecordMessageItem;
    });
    const proposalItems = (assessment.proposals as Array<any>).map((proposal) => ({
        id: proposal.id,
        title: `Proposta v${proposal.version}`,
        detail: summarizeProposal(proposal).label,
        eyebrow: proposal.status,
        at: proposal.updatedAt.toISOString(),
        tone: proposal.status === "accepted" ? "positive" : proposal.status === "sent" ? "warning" : "neutral",
    } satisfies CrmRecordTimelineItem));
    const activityItems = (assessment.deal?.activities as Array<any> ?? []).map((activity) => ({
        id: activity.id,
        title: activity.type.replaceAll("_", " "),
        detail: activity.note || "Sem nota adicional",
        eyebrow: "activity",
        at: activity.createdAt.toISOString(),
        tone: activity.type.includes("changed") ? "warning" : "neutral",
    } satisfies CrmRecordTimelineItem));
    const meetingItems = (meetings as Array<any>).map((meeting) => ({
        id: meeting.id,
        title: meeting.leadEmail || "Agenda comercial",
        detail: meeting.recommendedCTA || `Status ${meeting.status}`,
        eyebrow: formatDateTime(meeting.startAt),
        at: meeting.startAt.toISOString(),
        tone: "positive",
    } satisfies CrmRecordTimelineItem));
    const timeline = composeCrmRecordTimeline({
        messages: messageItems.map((message) => ({
            id: message.id,
            direction: message.direction,
            text: message.text,
            statusLabel: message.status,
            at: message.at,
        })),
        activities: activityItems,
        proposals: proposalItems,
        meetings: meetingItems,
    });
    const lastInteractionAt = [
        messageItems[0]?.at ?? null,
        activityItems[0]?.at ?? null,
        proposalItems[0]?.at ?? null,
    ]
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
    const operationalSummary = buildCrmOperationalSummary({
        lastInteractionAt,
        unreadCount: primaryConversation?.unreadCount ?? 0,
        proposalStatus: assessment.proposals[0]?.status ?? "none",
        nextAction,
        nextActionAt,
        recommendations,
        hasUpcomingMeeting: meetings.length > 0,
    });
    const quickActions = buildCrmRecordQuickActions({
        orgSlug: input.orgSlug,
        conversationId: primaryConversation?.id ?? null,
        nextAction,
        nextActionAt,
        recommendations,
        proposalPublicSlug: assessment.proposals[0]?.publicSlug ?? null,
        proposalStatus: assessment.proposals[0]?.status ?? "none",
        hasDeal: Boolean(assessment.deal?.id),
    });

    const badges = [
        { id: "status", label: assessment.status, tone: "warning" as CrmTone },
        { id: "lifecycle", label: formatLifecycleLabel(assessment.contact?.lifecycle), tone: "neutral" as CrmTone },
        { id: "stage", label: deriveStageLabel(assessment.deal?.stage?.name), tone: "positive" as CrmTone },
        { id: "priority", label: `Prioridade ${priority}`, tone: resolvePriorityTone(priority) },
    ];
    if (assessment.contact?.optedOutAt) badges.push({ id: "blocked", label: "Contato bloqueado", tone: "critical" });

    return {
        id: assessment.id,
        company: assessment.company || "Lead sem empresa",
        primaryContact: assessment.contact?.name || assessment.name || "Contato sem nome",
        subtitle: `${assessment.email || "-"} · ${assessment.contact?.phoneNumberE164 || assessment.phone || "-"}`,
        segment: assessment.segment || "",
        urgency: assessment.urgency || "",
        goal: assessment.goal || "",
        status: assessment.status,
        contactLifecycle: assessment.contact?.lifecycle || "lead",
        dealStageLabel: deriveStageLabel(assessment.deal?.stage?.name),
        dealStageId: assessment.deal?.stageId ?? null,
        conversationId: primaryConversation?.id ?? null,
        ownerUserId,
        ownerLabel,
        priority,
        nextAction,
        nextActionAt,
        nextActionAtLabel: nextActionAt ? formatDateTime(nextActionAt) : "-",
        cadenceLabel,
        nicheValues: Object.fromEntries(
            niche.editableFieldIds.map((fieldId) => [
                fieldId,
                resolveExtensionValue(fieldId, extensionContext),
            ]),
        ),
        editableValues: {
            status: assessment.status,
            lifecycle: assessment.contact?.lifecycle || "lead",
            stage: assessment.deal?.stageId ?? "",
            owner: ownerUserId ?? "",
            priority,
            nextAction,
            nextActionAt: nextActionAt ?? "",
            segment: assessment.segment || "",
            urgency: assessment.urgency || "",
            goal: assessment.goal || "",
            ...Object.fromEntries(
                niche.editableFieldIds.map((fieldId) => [
                    fieldId,
                    resolveExtensionValue(fieldId, extensionContext) === "-"
                        ? ""
                        : resolveExtensionValue(fieldId, extensionContext),
                ]),
            ),
        },
        recommendations,
        conversation: primaryConversation ? {
            label: conversationAttention?.label ?? "Conversa ativa",
            detail: conversationAttention?.detail ?? "Conversa vinculada ao registro.",
            tone: conversationAttention?.tone ?? "neutral",
            statusLabel: resolveConversationStatusLabel(primaryConversation.status),
            unreadLabel: primaryConversation.unreadCount > 0 ? `${primaryConversation.unreadCount} nao lidas` : "Sem fila pendente",
            lastMessagePreview: primaryConversation.lastMessagePreview || "Sem preview recente",
            lastMessageAtLabel: primaryConversation.lastMessageAt ? formatDateTime(primaryConversation.lastMessageAt) : "Sem mensagem recente",
            slaLabel: primaryConversation.slaDueAt ? formatDateTime(primaryConversation.slaDueAt) : "Sem SLA ativo",
            assignmentLabel: ownerLabel,
        } : null,
        operationalSummary,
        badges,
        quickActions,
        quickLinks: [
            { id: "crm", label: "Voltar ao workspace", href: `/org/${input.orgSlug}/admin/crm` },
            { id: "whatsapp", label: "Abrir WhatsApp CRM", href: `/org/${input.orgSlug}/admin/whatsapp` },
            { id: "deals", label: "Abrir deal flow", href: `/org/${input.orgSlug}/admin/deals` },
        ],
        overview: buildDetailSection({
            id: "overview",
            title: "Visao 360",
            description: "Nucleo canonico do registro comercial.",
            values: [
                { id: "score", label: "Score", value: `${assessment.scoreTotal} · ${assessment.classification}` },
                { id: "segment", label: "Segmento", value: assessment.segment || "-" },
                { id: "goal", label: "Objetivo", value: assessment.goal || "-" },
                { id: "urgency", label: "Urgencia", value: assessment.urgency || "-" },
                { id: "owner", label: "Responsavel", value: ownerLabel },
                { id: "priority", label: "Prioridade", value: priority },
                { id: "cadence", label: "Cadencia ativa", value: cadenceLabel },
                { id: "nextAction", label: "Proxima acao", value: nextAction || "-" },
                { id: "nextActionAt", label: "Proxima data", value: nextActionAt ? formatDateTime(nextActionAt) : "-" },
                { id: "phone", label: "Telefone", value: assessment.contact?.phoneNumberE164 || assessment.phone || "-" },
                { id: "whatsapp", label: "WhatsApp ID", value: assessment.contact?.wa_id || "-" },
                { id: "missions", label: "Missoes", value: parseJsonArray(assessment.recommendedMissions).join(", ") || "-" },
                { id: "lastMessage", label: "Ultima mensagem", value: assessment.contact?.lastMessageAt ? formatDateTime(assessment.contact.lastMessageAt) : "-" },
            ],
        }),
        nicheSections: niche.detailSections.map((section) => buildDetailSection({
            id: section.id,
            title: section.title,
            description: section.description,
            values: section.fieldIds.map((fieldId) => ({
                id: fieldId,
                label: FIELD_CATALOG[fieldId as FieldCatalogKey].label,
                value: resolveExtensionValue(fieldId as FieldCatalogKey, extensionContext),
            })),
        })),
        timeline,
        proposals: proposalItems,
        activities: activityItems,
        agenda: meetingItems,
        messages: messageItems,
    };
}

function sanitizeInlineTextValue(value: string, maxLength: number, errorCode: string) {
    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength) {
        throw new Error(errorCode);
    }

    return normalized;
}

function resolveNicheEditableFieldId(field: CrmEditableField): ControlledNicheEditableFieldId | null {
    if (!field.startsWith("workspace.niche.")) return null;
    return field.replace("workspace.niche.", "") as ControlledNicheEditableFieldId;
}

function validateAssessmentInlineValue(field: Extract<CrmEditableField, "assessment.segment" | "assessment.urgency" | "assessment.goal">, value: string) {
    if (field === "assessment.segment") return sanitizeInlineTextValue(value, 80, "INVALID_ASSESSMENT_SEGMENT");
    if (field === "assessment.urgency") return sanitizeInlineTextValue(value, 80, "INVALID_ASSESSMENT_URGENCY");
    return sanitizeInlineTextValue(value, 160, "INVALID_ASSESSMENT_GOAL");
}

function validateControlledFieldValue(
    fieldId: FieldCatalogKey,
    value: string,
    errorCode: string,
) {
    const fieldDefinition = getFieldCatalogEntry(fieldId);
    const normalized = value.trim();

    if (fieldDefinition.valueType === "select" && fieldDefinition.options) {
        if (!fieldDefinition.options.some((option) => option.value === normalized)) {
            throw new Error(errorCode);
        }

        return normalized;
    }

    return sanitizeInlineTextValue(normalized, 120, errorCode);
}

function resolveCrmPlaybookDefinition(playbookId: CrmPlaybookId) {
    return CRM_PLAYBOOKS.find((playbook) => playbook.id === playbookId) ?? null;
}

function addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addHours(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function buildPlaybookNextAction(input: {
    playbook: CrmPlaybookDefinition;
    cadenceTemplate: CrmCadenceTemplate | null;
    step: number;
    totalSteps: number;
}) {
    if (input.playbook.id === "follow-up-initial") return `Realizar follow-up inicial · toque ${input.step}/${input.totalSteps}`;
    if (input.playbook.id === "reactivate-silent-lead") return `Reativar lead silencioso · toque ${input.step}/${input.totalSteps}`;
    if (input.playbook.id === "revive-stalled-proposal") return `Cobrar proposta parada · toque ${input.step}/${input.totalSteps}`;
    if (input.playbook.id === "prepare-meeting") return `Preparar reuniao · passo ${input.step}/${input.totalSteps}`;
    if (input.playbook.id === "advance-opportunity") return `Avancar oportunidade · passo ${input.step}/${input.totalSteps}`;
    return input.cadenceTemplate
        ? `${input.cadenceTemplate.label} · passo ${input.step}/${input.totalSteps}`
        : `Executar proximo toque · passo ${input.step}/${input.totalSteps}`;
}

function resolvePlaybookPlan(input: {
    playbookId: CrmPlaybookId;
    currentCadence: WorkspaceCadenceState | null;
    nextMeetingAt: string | null;
}) {
    const playbook = resolveCrmPlaybookDefinition(input.playbookId);
    if (!playbook) throw new Error("INVALID_PLAYBOOK");

    if (playbook.id === "advance-active-cadence") {
        if (!input.currentCadence) throw new Error("CADENCE_NOT_AVAILABLE");
        const cadenceTemplate = resolveCadenceTemplate(input.currentCadence.id);
        if (!cadenceTemplate) throw new Error("CADENCE_NOT_AVAILABLE");

        const nextStep = Math.min(input.currentCadence.step + 1, input.currentCadence.totalSteps);
        const nextDueAt = addDays(new Date(), cadenceTemplate.stepOffsetsDays[Math.max(nextStep - 1, 0)] ?? 0).toISOString();
        const nextCadence: WorkspaceCadenceState = {
            id: cadenceTemplate.id,
            step: nextStep,
            totalSteps: cadenceTemplate.stepOffsetsDays.length,
            dueAt: nextDueAt,
        };

        return {
            playbook,
            priority: undefined,
            nextAction: buildPlaybookNextAction({
                playbook,
                cadenceTemplate,
                step: nextStep,
                totalSteps: cadenceTemplate.stepOffsetsDays.length,
            }),
            nextActionAt: nextDueAt,
            cadence: nextCadence,
        };
    }

    const cadenceTemplate = resolveCadenceTemplate(playbook.cadenceId);
    const step = 1;
    const totalSteps = cadenceTemplate?.stepOffsetsDays.length ?? 1;
    let nextActionAt = addDays(new Date(), cadenceTemplate?.stepOffsetsDays[0] ?? 1).toISOString();

    if (playbook.id === "prepare-meeting" && input.nextMeetingAt) {
        const meetingDate = new Date(input.nextMeetingAt);
        const prepDate = addHours(meetingDate, -3);
        nextActionAt = (prepDate.getTime() > Date.now() ? prepDate : addHours(new Date(), 2)).toISOString();
    }

    return {
        playbook,
        priority: playbook.defaultPriority,
        nextAction: buildPlaybookNextAction({
            playbook,
            cadenceTemplate,
            step,
            totalSteps,
        }),
        nextActionAt,
        cadence: cadenceTemplate
            ? {
                id: cadenceTemplate.id,
                step,
                totalSteps,
                dueAt: nextActionAt,
            }
            : null,
    };
}

export async function updateCrmInlineField(input: UpdateCrmInlineFieldInput): Promise<UpdateCrmInlineFieldResult> {
    assertRole(input.role, "closer");

    const assessment = await prisma.assessment.findFirst({
        where: {
            id: input.assessmentId,
            organizationId: input.organizationId,
        },
        select: {
            id: true,
            status: true,
            segment: true,
            urgency: true,
            goal: true,
            internalNotes: true,
            contact: {
                select: {
                    id: true,
                    lifecycle: true,
                    conversations: {
                        orderBy: { lastMessageAt: "desc" },
                        take: 1,
                        select: {
                            id: true,
                            assignedUserId: true,
                            user: {
                                select: {
                                    email: true,
                                },
                            },
                        },
                    },
                },
            },
            deal: {
                select: {
                    id: true,
                    stageId: true,
                    stage: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        },
    });

    if (!assessment) throw new Error("ASSESSMENT_NOT_FOUND");

    if (input.field === "assessment.status") {
        if (assessment.status !== input.value) {
            await prisma.assessment.update({
                where: { id: assessment.id },
                data: { status: input.value },
            });
            if (assessment.deal?.id) {
                await prisma.activity.create({
                    data: {
                        organizationId: input.organizationId,
                        dealId: assessment.deal.id,
                        type: "assessment_status_changed",
                        note: `Assessment ${assessment.id} status changed from ${assessment.status} to ${input.value}`,
                    },
                });
            }
        }

        return {
            assessmentId: assessment.id,
            field: input.field,
            value: input.value,
            conversationId: assessment.contact?.conversations?.[0]?.id ?? null,
        };
    }

    if (input.field === "assessment.segment" || input.field === "assessment.urgency" || input.field === "assessment.goal") {
        const nextValue = validateAssessmentInlineValue(input.field, input.value);
        const currentValue = input.field === "assessment.segment"
            ? assessment.segment
            : input.field === "assessment.urgency"
                ? assessment.urgency
                : assessment.goal;

        if (currentValue !== nextValue) {
            await prisma.assessment.update({
                where: { id: assessment.id },
                data: input.field === "assessment.segment"
                    ? { segment: nextValue }
                    : input.field === "assessment.urgency"
                        ? { urgency: nextValue }
                        : { goal: nextValue },
            });

            if (assessment.deal?.id) {
                await prisma.activity.create({
                    data: {
                        organizationId: input.organizationId,
                        dealId: assessment.deal.id,
                        type: "assessment_qualification_changed",
                        note: `${input.field.replace("assessment.", "")} changed from ${currentValue || "empty"} to ${nextValue}`,
                    },
                });
            }
        }

        return {
            assessmentId: assessment.id,
            field: input.field,
            value: nextValue,
            conversationId: assessment.contact?.conversations?.[0]?.id ?? null,
        };
    }

    if (input.field === "workspace.priority") {
        if (!PRIORITY_OPTIONS.some((option) => option.value === input.value)) {
            throw new Error("INVALID_PRIORITY");
        }

        const currentPriority = parseWorkspaceMetadata(assessment.internalNotes).priority;
        if (currentPriority !== input.value) {
            await prisma.assessment.update({
                where: { id: assessment.id },
                data: {
                    internalNotes: serializeWorkspaceMetadata(assessment.internalNotes, {
                        priority: input.value,
                    }),
                },
            });

            if (assessment.deal?.id) {
                await prisma.activity.create({
                    data: {
                        organizationId: input.organizationId,
                        dealId: assessment.deal.id,
                        type: "crm_priority_changed",
                        note: `CRM priority changed from ${currentPriority ?? "unset"} to ${input.value}`,
                    },
                });
            }
        }

        return {
            assessmentId: assessment.id,
            field: input.field,
            value: input.value,
            conversationId: assessment.contact?.conversations?.[0]?.id ?? null,
        };
    }

    if (input.field === "workspace.lostReason") {
        if (!LOSS_REASON_OPTIONS.some((option) => option.value === input.value)) {
            throw new Error("INVALID_LOSS_REASON");
        }

        const currentLostReason = parseWorkspaceMetadata(assessment.internalNotes).lostReason;
        if (currentLostReason !== input.value) {
            await prisma.assessment.update({
                where: { id: assessment.id },
                data: {
                    internalNotes: serializeWorkspaceMetadata(assessment.internalNotes, {
                        lostReason: input.value,
                    }),
                },
            });

            if (assessment.deal?.id) {
                await prisma.activity.create({
                    data: {
                        organizationId: input.organizationId,
                        dealId: assessment.deal.id,
                        type: "crm_lost_reason_changed",
                        note: `CRM lost reason changed from ${currentLostReason ?? "unset"} to ${input.value}`,
                    },
                });
            }
        }

        return {
            assessmentId: assessment.id,
            field: input.field,
            value: input.value,
            conversationId: assessment.contact?.conversations?.[0]?.id ?? null,
        };
    }

    if (input.field === "workspace.nextAction") {
        const nextAction = input.value.trim();
        if (nextAction.length > 160) {
            throw new Error("INVALID_NEXT_ACTION");
        }

        await prisma.assessment.update({
            where: { id: assessment.id },
            data: {
                internalNotes: serializeWorkspaceMetadata(assessment.internalNotes, {
                    nextAction,
                }),
            },
        });

        if (assessment.deal?.id) {
            await prisma.activity.create({
                data: {
                    organizationId: input.organizationId,
                    dealId: assessment.deal.id,
                    type: "crm_next_action_changed",
                    note: `CRM next action updated to ${nextAction || "empty"}`,
                },
            });
        }

        return {
            assessmentId: assessment.id,
            field: input.field,
            value: nextAction,
            conversationId: assessment.contact?.conversations?.[0]?.id ?? null,
        };
    }

    if (input.field === "workspace.nextActionAt") {
        const nextActionAt = input.value.trim();
        if (nextActionAt) {
            const parsed = new Date(nextActionAt);
            if (Number.isNaN(parsed.getTime())) {
                throw new Error("INVALID_NEXT_ACTION_AT");
            }
        }

        await prisma.assessment.update({
            where: { id: assessment.id },
            data: {
                internalNotes: serializeWorkspaceMetadata(assessment.internalNotes, {
                    nextActionAt: nextActionAt || null,
                }),
            },
        });

        if (assessment.deal?.id) {
            await prisma.activity.create({
                data: {
                    organizationId: input.organizationId,
                    dealId: assessment.deal.id,
                    type: "crm_next_action_at_changed",
                    note: `CRM next action date updated to ${nextActionAt || "empty"}`,
                },
            });
        }

        return {
            assessmentId: assessment.id,
            field: input.field,
            value: nextActionAt,
            conversationId: assessment.contact?.conversations?.[0]?.id ?? null,
        };
    }

    if (input.field === "proposal.status") {
        const allowed = PROPOSAL_STATUS_OPTIONS.map((option) => option.value);
        if (!allowed.includes(input.value)) {
            throw new Error("INVALID_PROPOSAL_STATUS");
        }

        const latestProposal = await prisma.proposal.findFirst({
            where: {
                assessmentId: assessment.id,
            },
            orderBy: {
                version: "desc",
            },
        });

        if (!latestProposal) {
            throw new Error("PROPOSAL_NOT_AVAILABLE");
        }

        if (latestProposal.status !== input.value) {
            await prisma.proposal.update({
                where: { id: latestProposal.id },
                data: {
                    status: input.value,
                    updatedAt: new Date(),
                },
            });

            if (assessment.deal?.id) {
                await prisma.activity.create({
                    data: {
                        organizationId: input.organizationId,
                        dealId: assessment.deal.id,
                        type: "proposal_status_changed",
                        note: `Proposal ${latestProposal.id} status changed from ${latestProposal.status} to ${input.value}`,
                    },
                });
            }
        }

        return {
            assessmentId: assessment.id,
            field: input.field,
            value: input.value,
            conversationId: assessment.contact?.conversations?.[0]?.id ?? null,
        };
    }

    if (input.field === "conversation.assignedUserId") {
        const conversation = assessment.contact?.conversations?.[0];
        if (!conversation?.id) throw new Error("CONVERSATION_NOT_AVAILABLE");

        let ownerEmail = "Sem responsavel";
        if (input.value) {
            const owner = await prisma.user.findFirst({
                where: {
                    id: input.value,
                    organizationId: input.organizationId,
                },
                select: {
                    id: true,
                    email: true,
                },
            });

            if (!owner) throw new Error("OWNER_NOT_AVAILABLE");
            ownerEmail = owner.email;
        }

        if ((conversation.assignedUserId ?? "") !== input.value) {
            await prisma.whatsAppConversation.update({
                where: { id: conversation.id },
                data: {
                    assignedUserId: input.value || null,
                },
            });

            if (assessment.deal?.id) {
                await prisma.activity.create({
                    data: {
                        organizationId: input.organizationId,
                        dealId: assessment.deal.id,
                        type: "crm_owner_changed",
                        note: `CRM owner changed from ${conversation.user?.email ?? "Sem responsavel"} to ${ownerEmail}`,
                    },
                });
            }
        }

        return {
            assessmentId: assessment.id,
            field: input.field,
            value: input.value,
            conversationId: conversation.id,
        };
    }

    const nicheFieldId = resolveNicheEditableFieldId(input.field);
    if (nicheFieldId) {
        const organization = await prisma.organization.findUnique({
            where: { id: input.organizationId },
            select: { industry: true },
        });
        const niche = resolveCrmNicheDefinition(organization?.industry ?? "Services");
        if (!niche.editableFieldIds.includes(nicheFieldId)) {
            throw new Error("INVALID_NICHE_FIELD");
        }

        const nextValue = validateControlledFieldValue(nicheFieldId, input.value, "INVALID_NICHE_VALUE");
        const currentMetadata = parseWorkspaceMetadata(assessment.internalNotes);
        const currentValue = typeof currentMetadata.nicheValues[nicheFieldId] === "string"
            ? String(currentMetadata.nicheValues[nicheFieldId])
            : "";

        if (currentValue !== nextValue) {
            await prisma.assessment.update({
                where: { id: assessment.id },
                data: {
                    internalNotes: serializeWorkspaceMetadata(assessment.internalNotes, {
                        nicheValues: {
                            [nicheFieldId]: nextValue,
                        },
                    }),
                },
            });

            if (assessment.deal?.id) {
                await prisma.activity.create({
                    data: {
                        organizationId: input.organizationId,
                        dealId: assessment.deal.id,
                        type: "crm_niche_field_changed",
                        note: `${FIELD_CATALOG[nicheFieldId].label} changed from ${currentValue || "empty"} to ${nextValue}`,
                    },
                });
            }
        }

        return {
            assessmentId: assessment.id,
            field: input.field,
            value: nextValue,
            conversationId: assessment.contact?.conversations?.[0]?.id ?? null,
        };
    }

    const commercialFlow = await ensureAssessmentCommercialFlow({
        assessmentId: assessment.id,
        source: "assessment",
    });

    if (input.field === "contact.lifecycle") {
        if (!commercialFlow.contactId) throw new Error("CONTACT_NOT_AVAILABLE");

        const contact = await prisma.contact.findFirst({
            where: {
                id: commercialFlow.contactId,
                organizationId: input.organizationId,
            },
            select: {
                id: true,
                lifecycle: true,
                conversations: {
                    orderBy: { lastMessageAt: "desc" },
                    take: 1,
                    select: { id: true },
                },
            },
        });

        if (!contact) throw new Error("CONTACT_NOT_AVAILABLE");

        if (contact.lifecycle !== input.value) {
            await prisma.contact.update({
                where: { id: contact.id },
                data: { lifecycle: input.value },
            });
            if (commercialFlow.dealId) {
                await prisma.activity.create({
                    data: {
                        organizationId: input.organizationId,
                        dealId: commercialFlow.dealId,
                        type: "contact_lifecycle_changed",
                        note: `Contact lifecycle changed from ${contact.lifecycle} to ${input.value}`,
                    },
                });
            }
        }

        return {
            assessmentId: assessment.id,
            field: input.field,
            value: input.value,
            conversationId: contact.conversations[0]?.id ?? null,
        };
    }

    if (input.field !== "deal.stageId") {
        throw new Error("INVALID_EDITABLE_FIELD");
    }

    if (!commercialFlow.dealId) throw new Error("DEAL_NOT_AVAILABLE");

    const stage = await prisma.pipelineStage.findFirst({
        where: {
            id: input.value,
            pipeline: {
                organizationId: input.organizationId,
            },
        },
        select: {
            id: true,
            name: true,
        },
    });

    if (!stage) throw new Error("STAGE_NOT_FOUND");

    const currentDeal = await prisma.deal.findFirst({
        where: {
            id: commercialFlow.dealId,
            organizationId: input.organizationId,
        },
        select: {
            id: true,
            stageId: true,
            stage: {
                select: {
                    name: true,
                },
            },
        },
    });

    if (!currentDeal) throw new Error("DEAL_NOT_AVAILABLE");

    if (currentDeal.stageId !== stage.id) {
        await prisma.deal.update({
            where: { id: currentDeal.id },
            data: { stageId: stage.id },
        });
        await prisma.activity.create({
            data: {
                organizationId: input.organizationId,
                dealId: currentDeal.id,
                type: "deal_stage_changed",
                note: `Deal stage changed from ${currentDeal.stage?.name ?? currentDeal.stageId} to ${stage.name}`,
            },
        });
    }

    return {
        assessmentId: assessment.id,
        field: input.field,
        value: stage.id,
        conversationId: assessment.contact?.conversations?.[0]?.id ?? null,
    };
}

export async function executeCrmBulkAction(input: ExecuteCrmBulkActionInput): Promise<ExecuteCrmBulkActionResult> {
    assertRole(input.role, "closer");

    const uniqueAssessmentIds = Array.from(new Set(input.assessmentIds.map((assessmentId) => assessmentId.trim()).filter(Boolean)));
    if (uniqueAssessmentIds.length === 0) {
        throw new Error("INVALID_BULK_SELECTION");
    }
    if (uniqueAssessmentIds.length > CRM_BULK_ACTION_LIMIT) {
        throw new Error("BULK_LIMIT_EXCEEDED");
    }
    if (!CRM_BULK_EDITABLE_FIELDS.includes(input.field)) {
        throw new Error("INVALID_BULK_FIELD");
    }

    const results: ExecuteCrmBulkActionResult["results"] = [];

    for (const assessmentId of uniqueAssessmentIds) {
        try {
            const result = await updateCrmInlineField({
                organizationId: input.organizationId,
                role: input.role,
                assessmentId,
                field: input.field,
                value: input.value,
            });

            results.push({
                assessmentId,
                success: true,
                result,
            });
        } catch (error) {
            results.push({
                assessmentId,
                success: false,
                error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
            });
        }
    }

    const successCount = results.filter((result) => result.success).length;

    return {
        field: input.field,
        value: input.value,
        totalRequested: uniqueAssessmentIds.length,
        successCount,
        failureCount: results.length - successCount,
        results,
    };
}

export async function executeCrmPlaybook(input: ExecuteCrmPlaybookInput): Promise<ExecuteCrmPlaybookResult> {
    assertRole(input.role, "closer");

    const uniqueAssessmentIds = Array.from(new Set(input.assessmentIds.map((assessmentId) => assessmentId.trim()).filter(Boolean)));
    if (uniqueAssessmentIds.length === 0) {
        throw new Error("INVALID_PLAYBOOK_SELECTION");
    }
    if (uniqueAssessmentIds.length > CRM_PLAYBOOK_ACTION_LIMIT) {
        throw new Error("PLAYBOOK_LIMIT_EXCEEDED");
    }

    const playbook = resolveCrmPlaybookDefinition(input.playbookId);
    if (!playbook) throw new Error("INVALID_PLAYBOOK");
    if (input.sourceViewId && !playbook.viewIds.includes(input.sourceViewId)) {
        throw new Error("PLAYBOOK_CONTEXT_MISMATCH");
    }

    const results: ExecuteCrmPlaybookResult["results"] = [];

    for (const assessmentId of uniqueAssessmentIds) {
        try {
            const assessment = await prisma.assessment.findFirst({
                where: {
                    id: assessmentId,
                    organizationId: input.organizationId,
                },
                select: {
                    id: true,
                    company: true,
                    internalNotes: true,
                    dealId: true,
                    contact: {
                        select: {
                            conversations: {
                                orderBy: { lastMessageAt: "desc" },
                                take: 1,
                                select: {
                                    unreadCount: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!assessment) {
                results.push({
                    assessmentId,
                    success: false,
                    error: "ASSESSMENT_NOT_FOUND",
                });
                continue;
            }

            const nextMeeting = await (prisma as any).meetingSession.findFirst({
                where: {
                    organizationId: input.organizationId,
                    assessmentId,
                    status: { in: ["scheduled", "confirmed", "rescheduled", "active", "pending"] },
                },
                orderBy: { startAt: "asc" },
                select: {
                    startAt: true,
                },
            }).catch(() => null);

            const workspaceMetadata = parseWorkspaceMetadata(assessment.internalNotes);
            const plan = resolvePlaybookPlan({
                playbookId: input.playbookId,
                currentCadence: workspaceMetadata.cadence,
                nextMeetingAt: nextMeeting?.startAt?.toISOString?.() ?? null,
            });

            await prisma.assessment.update({
                where: { id: assessment.id },
                data: {
                    internalNotes: serializeWorkspaceMetadata(assessment.internalNotes, {
                        priority: plan.priority ?? workspaceMetadata.priority,
                        nextAction: plan.nextAction,
                        nextActionAt: plan.nextActionAt,
                        cadence: plan.cadence,
                    }),
                },
            });

            await prisma.auditEvent.create({
                data: {
                    organizationId: input.organizationId,
                    assessmentId: assessment.id,
                    action: "crm_playbook_applied",
                    details: JSON.stringify({
                        playbookId: input.playbookId,
                        cadenceId: plan.cadence?.id ?? null,
                        nextAction: plan.nextAction,
                        nextActionAt: plan.nextActionAt,
                    }),
                },
            }).catch(() => null);

            if (assessment.dealId) {
                await prisma.activity.create({
                    data: {
                        organizationId: input.organizationId,
                        dealId: assessment.dealId,
                        type: "crm_playbook_applied",
                        note: `${playbook.label} aplicado para ${assessment.company || assessment.id} · ${plan.nextAction}`,
                    },
                }).catch(() => null);
            }

            results.push({
                assessmentId,
                success: true,
                cadenceLabel: formatCadenceLabel(plan.cadence),
            });
        } catch (error) {
            results.push({
                assessmentId,
                success: false,
                error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
            });
        }
    }

    const successCount = results.filter((result) => result.success).length;

    return {
        playbookId: input.playbookId,
        totalRequested: uniqueAssessmentIds.length,
        successCount,
        failureCount: results.length - successCount,
        results,
    };
}
