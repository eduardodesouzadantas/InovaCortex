jest.mock("next/link", () => {
    const ReactModule = jest.requireActual<typeof import("react")>("react");
    return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
            ReactModule.createElement("a", { href, ...props }, children),
    };
});

import { renderToStaticMarkup } from "react-dom/server";

import { CrmWorkspaceView } from "../app/org/[slug]/admin/crm/_components/crm-workspace-view";
import type { CrmRecordDetailModel, CrmWorkspaceRecord, OperatorCrmWorkspaceModel } from "../lib/operator/crm-workspace";

function createRecord(overrides: Partial<CrmWorkspaceRecord> = {}): CrmWorkspaceRecord {
    return {
        id: "assessment-1",
        company: "Acme",
        primaryContact: "Ana",
        email: "ana@acme.com",
        phone: "+5511999999999",
        status: "Novo",
        contactLifecycle: "lead",
        dealStageId: "stage-1",
        dealStageLabel: "Contato",
        proposalStatus: "sent",
        proposalLabel: "sent - v2",
        scoreLabel: "72 - Alta",
        lastTouchAt: "2026-03-16T12:00:00.000Z",
        lastTouchLabel: "16/03/2026 12:00",
        nextMeetingLabel: "17/03/2026 09:00",
        unreadCount: 2,
        activityCount: 3,
        tags: ["vip"],
        tone: "warning",
        boardColumnId: "stage-1",
        boardColumnByView: {
            all: "stage-1",
            pipeline: "stage-1",
            "follow-up": "high",
            meetings: "meetings-today",
        },
        conversationId: "conv-1",
        ownerUserId: "user-1",
        ownerLabel: "closer@acme.com",
        priority: "high",
        nextAction: "Ligar para validar escopo",
        nextActionAt: "2026-03-17T14:00:00.000Z",
        nextActionAtLabel: "17/03/2026 14:00",
        cadenceLabel: "Cadencia de follow-up inicial · passo 1/3",
        recommendedActionLabel: "Cobrar proposta parada",
        needsAttention: true,
        hasDeal: true,
        hasConversation: true,
        viewIds: ["all", "follow-up", "pipeline"],
        extensionValues: {
            monthlyRevenue: "R$ 25.000",
            responseTime: "15 min",
            hoursLost: "8",
        },
        ...overrides,
    };
}

function createWorkspace(overrides: Partial<OperatorCrmWorkspaceModel> = {}): OperatorCrmWorkspaceModel {
    return {
        generatedAt: "2026-03-16T12:00:00.000Z",
        orgSlug: "acme",
        orgName: "Acme",
        industry: "Services",
        summary: {
            headline: "CRM workspace de Acme",
            subheadline: "Workspace operacional editavel para operar conta, contato, deal e proposta.",
            metrics: [
                { id: "records", label: "Registros vivos", value: "1", detail: "Fluxo canonico conectado", tone: "positive" },
            ],
            focus: ["Atacar follow-ups antes de abrir novas frentes."],
        },
        niche: {
            key: "services",
            label: "Services CRM",
            description: "Workspace para servicos.",
            tableFieldIds: ["monthlyRevenue", "responseTime", "hoursLost"],
            editableFieldIds: [],
            detailSections: [],
        },
        table: {
            columns: [
                { id: "company", label: "Conta", kind: "text", valueType: "text", viewIds: ["all", "pipeline"] },
                { id: "status", label: "Status", kind: "status", valueType: "select", viewIds: ["all"], editableField: "assessment.status", options: [{ value: "Novo", label: "Novo" }] },
                { id: "stage", label: "Stage", kind: "stage", valueType: "select", viewIds: ["all", "pipeline"], editableField: "deal.stageId", options: [{ value: "stage-1", label: "Contato" }] },
                { id: "lifecycle", label: "Lifecycle", kind: "lifecycle", valueType: "select", viewIds: ["all"], editableField: "contact.lifecycle", options: [{ value: "lead", label: "Lead" }] },
                { id: "owner", label: "Responsavel", kind: "text", valueType: "select", viewIds: ["all", "pipeline"], editableField: "conversation.assignedUserId", options: [{ value: "", label: "Sem responsavel" }, { value: "user-1", label: "closer@acme.com" }] },
                { id: "priority", label: "Prioridade", kind: "text", valueType: "select", viewIds: ["all", "pipeline"], editableField: "workspace.priority", options: [{ value: "high", label: "Alta" }] },
                { id: "nextAction", label: "Proxima acao", kind: "text", valueType: "text", viewIds: ["all"], editableField: "workspace.nextAction" },
                { id: "nextActionAt", label: "Proxima data", kind: "text", valueType: "datetime", viewIds: ["all"], editableField: "workspace.nextActionAt" },
                { id: "proposal", label: "Proposta", kind: "text", valueType: "text", viewIds: ["all", "pipeline"] },
                { id: "lastTouch", label: "Ultimo toque", kind: "text", valueType: "datetime", viewIds: ["all", "pipeline"] },
                { id: "monthlyRevenue", label: "Receita mensal", kind: "metric", valueType: "currency", viewIds: ["all"] },
                { id: "responseTime", label: "Tempo de resposta", kind: "metric", valueType: "text", viewIds: ["all"] },
                { id: "hoursLost", label: "Horas perdidas", kind: "metric", valueType: "number", viewIds: ["all"] },
            ],
            records: [createRecord()],
        },
        views: {
            defaultViewId: "all",
            presets: [
                {
                    id: "all",
                    kind: "system",
                    baseViewId: "all",
                    label: "Todos os leads",
                    description: "Workspace completo",
                    defaultMode: "table",
                    sortId: "last-touch-desc",
                    columnIds: ["company", "status", "stage", "owner", "priority", "proposal", "lastTouch"],
                },
                {
                    id: "pipeline",
                    kind: "system",
                    baseViewId: "pipeline",
                    label: "Por stage",
                    description: "Pipeline vivo",
                    defaultMode: "board",
                    sortId: "priority-desc",
                    columnIds: ["company", "stage", "owner", "priority"],
                },
            ],
            saved: [],
            system: [
                {
                    id: "all",
                    kind: "system",
                    baseViewId: "all",
                    label: "Todos os leads",
                    description: "Workspace completo",
                    defaultMode: "table",
                    sortId: "last-touch-desc",
                    columnIds: ["company", "status", "stage", "owner", "priority", "proposal", "lastTouch"],
                },
                {
                    id: "pipeline",
                    kind: "system",
                    baseViewId: "pipeline",
                    label: "Por stage",
                    description: "Pipeline vivo",
                    defaultMode: "board",
                    sortId: "priority-desc",
                    columnIds: ["company", "stage", "owner", "priority"],
                },
            ],
            sortOptions: [
                { id: "last-touch-desc", label: "Toque recente", description: "Ultimas interacoes no topo." },
                { id: "priority-desc", label: "Prioridade", description: "Critical e high primeiro." },
            ],
            saveScopes: [
                { value: "user", label: "Minha view" },
                { value: "tenant", label: "View do tenant" },
            ],
        },
        board: {
            columns: [{ id: "stage-1", label: "Contato", description: "1 registro", tone: "positive" }],
            columnsByView: {
                all: [{ id: "stage-1", label: "Contato", description: "1 registro", tone: "positive" }],
                "follow-up": [{ id: "high", label: "Alta", description: "1 registro com prioridade alta", tone: "warning" }],
                "stalled-proposals": [{ id: "sent", label: "Enviadas", description: "1 proposta nessa situacao", tone: "warning" }],
                "quiet-window": [{ id: "idle-5-7", label: "5-7 dias", description: "0 registros sem resposta nessa janela", tone: "warning" }],
                meetings: [{ id: "meetings-today", label: "Hoje", description: "1 registro reunioes no mesmo dia", tone: "positive" }],
                pipeline: [{ id: "stage-1", label: "Contato", description: "1 registro", tone: "positive" }],
                "revenue-risk": [],
                proposals: [{ id: "viewed", label: "Viewed", description: "1 proposta visualizada", tone: "warning" }],
            },
        },
        editable: {
            assessmentStatus: [{ value: "Novo", label: "Novo" }],
            contactLifecycle: [{ value: "lead", label: "Lead" }],
            dealStage: [{ value: "stage-1", label: "Contato" }],
            owner: [{ value: "", label: "Sem responsavel" }, { value: "user-1", label: "closer@acme.com" }],
            priority: [{ value: "high", label: "Alta" }, { value: "medium", label: "Media" }],
            detailEditors: [
                { id: "status", field: "assessment.status", columnId: "status", label: "Status", valueType: "select", options: [{ value: "Novo", label: "Novo" }], section: "workflow" },
                { id: "goal", field: "assessment.goal", columnId: "goal", label: "Objetivo", valueType: "text", section: "qualification" },
            ],
            bulkActions: [
                { id: "priority", field: "workspace.priority", label: "Prioridade", description: "Atualiza a prioridade.", valueType: "select", options: [{ value: "high", label: "Alta" }, { value: "medium", label: "Media" }] },
            ],
        },
        shortcuts: {
            byView: {
                all: [],
                "follow-up": [{ id: "follow-up-next-touch", label: "Marcar proximos contatos", description: "Prefill follow-up", field: "workspace.nextAction", suggestedValue: "Realizar follow-up" }],
                "stalled-proposals": [],
                "quiet-window": [],
                meetings: [],
                pipeline: [],
                "revenue-risk": [],
                proposals: [{ id: "proposals-follow-up", label: "Revisar proposta aberta", description: "Ação rápida para propostas abertas", field: "workspace.nextAction", suggestedValue: "Enviar lembrete de proposta" }],
            },
            selectionLimit: 25,
        },
        automation: {
            cadenceTemplates: [
                { id: "initial-follow-up", label: "Cadencia de follow-up inicial", description: "Tres toques curtos.", stepOffsetsDays: [1, 3, 5] },
            ],
            playbooksByView: {
                all: [],
                "follow-up": [{ id: "follow-up-initial", label: "Follow-up inicial", description: "Inicia a cadencia.", viewIds: ["follow-up"], cadenceId: "initial-follow-up", defaultPriority: "high", actionLabel: "Iniciar follow-up" }],
                "stalled-proposals": [{ id: "revive-stalled-proposal", label: "Cobrar proposta parada", description: "Retoma proposta.", viewIds: ["stalled-proposals"], cadenceId: "proposal-revival", defaultPriority: "critical", actionLabel: "Cobrar proposta" }],
                "quiet-window": [{ id: "reactivate-silent-lead", label: "Reativar lead silencioso", description: "Retoma lead.", viewIds: ["quiet-window"], cadenceId: "silent-reactivation", defaultPriority: "high", actionLabel: "Reativar lead" }],
                meetings: [{ id: "prepare-meeting", label: "Preparar reuniao", description: "Prepara agenda.", viewIds: ["meetings"], cadenceId: "meeting-prep", defaultPriority: "medium", actionLabel: "Preparar agenda" }],
                pipeline: [{ id: "advance-opportunity", label: "Avancar oportunidade", description: "Move oportunidade.", viewIds: ["pipeline"], cadenceId: "opportunity-advance", defaultPriority: "high", actionLabel: "Avancar oportunidade" }],
                "revenue-risk": [],
                proposals: [{ id: "revive-stalled-proposal", label: "Cobrar proposta parada", description: "Retoma proposta.", viewIds: ["proposals"], cadenceId: "proposal-revival", defaultPriority: "critical", actionLabel: "Cobrar proposta" }],
            },
        },
        filters: {
            quick: [{ id: "all", label: "Tudo", description: "Workspace completo" }],
        },
        warnings: [],
        ...overrides,
    };
}

function createDetail(overrides: Partial<CrmRecordDetailModel> = {}): CrmRecordDetailModel {
    return {
        id: "assessment-1",
        company: "Acme",
        primaryContact: "Ana",
        subtitle: "ana@acme.com - +5511999999999",
        segment: "Consultoria",
        urgency: "Alta",
        goal: "Reduzir tempo de resposta",
        status: "Novo",
        contactLifecycle: "lead",
        dealStageLabel: "Contato",
        dealStageId: "stage-1",
        conversationId: "conv-1",
        ownerUserId: "user-1",
        ownerLabel: "closer@acme.com",
        priority: "high",
        nextAction: "Ligar para validar escopo",
        nextActionAt: "2026-03-17T14:00:00.000Z",
        nextActionAtLabel: "17/03/2026 14:00",
        cadenceLabel: "Cadencia de follow-up inicial · passo 1/3",
        nicheValues: {},
        editableValues: {
            status: "Novo",
            lifecycle: "lead",
            stage: "stage-1",
            owner: "user-1",
            priority: "high",
            nextAction: "Ligar para validar escopo",
            nextActionAt: "2026-03-17T14:00:00.000Z",
            segment: "Consultoria",
            urgency: "Alta",
            goal: "Reduzir tempo de resposta",
        },
        recommendations: [
            { id: "revive-stalled-proposal", title: "Cobrar proposta parada", reason: "A proposta foi enviada e pede retomada.", playbookId: "revive-stalled-proposal", actionLabel: "Cobrar proposta" },
        ],
        conversation: {
            label: "Resposta pendente",
            detail: "2 mensagens aguardam retorno no WhatsApp.",
            tone: "warning",
            statusLabel: "Aberta",
            unreadLabel: "2 nao lidas",
            lastMessagePreview: "Preciso de proposta",
            lastMessageAtLabel: "16/03/2026 12:00",
            slaLabel: "17/03/2026 14:00",
            assignmentLabel: "closer@acme.com",
        },
        operationalSummary: {
            lastInteractionLabel: "16/03/2026 12:00",
            pendingLabel: "2 mensagens aguardam retorno no canal.",
            nextBestActionLabel: "Cobrar proposta parada",
        },
        badges: [
            { id: "status", label: "Novo", tone: "warning" },
            { id: "lifecycle", label: "Lead", tone: "neutral" },
            { id: "stage", label: "Contato", tone: "positive" },
            { id: "priority", label: "Prioridade high", tone: "warning" },
        ],
        quickActions: [
            { id: "open-conversation", label: "Abrir conversa vinculada", description: "Continua atendimento", tone: "warning", kind: "link", href: "/org/acme/admin/whatsapp?conversationId=conv-1" },
            { id: "persist-next-action", label: "Registrar follow-up", description: "Salva proxima acao", tone: "positive", kind: "inline-update", field: "workspace.nextAction", value: "Ligar para validar escopo" },
            { id: "playbook:revive-stalled-proposal", label: "Cobrar proposta", description: "Retoma proposta", tone: "warning", kind: "playbook", playbookId: "revive-stalled-proposal" },
        ],
        quickLinks: [{ id: "crm", label: "Voltar ao workspace", href: "/org/acme/admin/crm" }],
        overview: {
            id: "overview",
            title: "Visao 360",
            description: "Nucleo canonico.",
            items: [{ id: "score", label: "Score", value: "72" }],
        },
        nicheSections: [],
        timeline: [
            { id: "message:msg-1", kind: "message", title: "Mensagem recebida", detail: "Preciso de proposta · Recebida", eyebrow: "conversa", at: "2026-03-16T12:00:00.000Z", tone: "warning" },
            { id: "proposal:proposal-1", kind: "proposal", title: "Proposta v2", detail: "sent", eyebrow: "proposal", at: "2026-03-16T12:00:00.000Z", tone: "warning" },
        ],
        proposals: [{ id: "proposal-1", title: "Proposta v2", detail: "sent", eyebrow: "proposal", at: "2026-03-16T12:00:00.000Z", tone: "warning" }],
        activities: [{ id: "activity-1", title: "assessment_linked", detail: "Linked", eyebrow: "activity", at: "2026-03-16T12:00:00.000Z", tone: "neutral" }],
        agenda: [],
        messages: [{ id: "msg-1", direction: "inbound", text: "Preciso de proposta", status: "received", at: "2026-03-16T12:00:00.000Z" }],
        ...overrides,
    };
}

describe("CRM workspace view", () => {
    test("renders an operator CRM workspace with editable table and 360 detail", () => {
        const html = renderToStaticMarkup(
            CrmWorkspaceView({
                slug: "acme",
                data: createWorkspace(),
                filteredRecords: [createRecord()],
                visibleColumns: createWorkspace().table.columns.slice(0, 7),
                allowedColumns: createWorkspace().table.columns.slice(0, 7),
                visibleColumnIds: createWorkspace().views.presets[0].columnIds,
                selectedView: createWorkspace().views.presets[0],
                search: "",
                viewMode: "table",
                selectedId: "assessment-1",
                selectedIds: ["assessment-1"],
                activeSortId: "last-touch-desc",
                detail: createDetail(),
                detailLoading: false,
                detailError: null,
                workspaceNotice: null,
                pendingMutationKey: null,
                bulkDefinition: createWorkspace().editable.bulkActions[0],
                bulkValue: "high",
                bulkPending: false,
                playbookPending: false,
                saveViewName: "",
                saveViewScope: "user",
                saveViewPending: false,
                workflowShortcuts: createWorkspace().shortcuts.byView["follow-up"],
                viewPlaybooks: createWorkspace().automation.playbooksByView["follow-up"],
                detailRecommendations: createDetail().recommendations,
            }),
        );

        expect(html).toContain("CRM Workspace");
        expect(html).toContain("Todos os leads");
        expect(html).toContain("Record 360");
        expect(html).toContain("Visao 360");
        expect(html).toContain("Qualificacao controlada");
        expect(html).toContain("Centro vivo de execucao");
        expect(html).toContain("Contexto conversacional");
        expect(html).toContain("Acoes rapidas");
        expect(html).toContain("Timeline operacional");
        expect(html).toContain("Abrir conversa vinculada");
        expect(html).toContain("Playbooks operacionais");
        expect(html).toContain("Acoes recomendadas");
        expect(html).toContain("Cobrar proposta parada");
        expect(html).toContain("Propostas vinculadas");
        expect(html).toContain("Mensagens recentes");
    });

    test("renders safe fallbacks with sparse data", () => {
        const html = renderToStaticMarkup(
            CrmWorkspaceView({
                slug: "acme",
                data: createWorkspace({
                    table: { ...createWorkspace().table, records: [] },
                    warnings: ["Ainda nao ha densidade suficiente no workspace."],
                }),
                filteredRecords: [],
                visibleColumns: createWorkspace().views.presets[1].columnIds.map((id) => createWorkspace().table.columns.find((column) => column.id === id)!).filter(Boolean),
                allowedColumns: createWorkspace().table.columns,
                visibleColumnIds: createWorkspace().views.presets[1].columnIds,
                selectedView: createWorkspace().views.presets[1],
                search: "ghost",
                viewMode: "board",
                selectedId: null,
                selectedIds: [],
                activeSortId: "priority-desc",
                detail: null,
                detailLoading: false,
                detailError: null,
                workspaceNotice: null,
                pendingMutationKey: null,
                bulkDefinition: createWorkspace().editable.bulkActions[0],
                bulkValue: "high",
                bulkPending: false,
                playbookPending: false,
                saveViewName: "",
                saveViewScope: "user",
                saveViewPending: false,
                workflowShortcuts: [],
                viewPlaybooks: [],
                detailRecommendations: [],
            }),
        );

        expect(html).toContain("Sem cards nesse stage.");
        expect(html).toContain("Leitura honesta");
        expect(html).toContain("Selecione um registro na table ou no board");
    });

    test("renders closed select options and contextual board columns for supported verticals", () => {
        const html = renderToStaticMarkup(
            CrmWorkspaceView({
                slug: "clinic",
                data: createWorkspace({
                    niche: {
                        key: "healthcare",
                        label: "Healthcare CRM",
                        description: "Workspace de clinica.",
                        tableFieldIds: ["appointmentWindow", "procedureType", "insuranceType"],
                        editableFieldIds: ["appointmentWindow"],
                        detailSections: [],
                    },
                    table: {
                        columns: [
                            ...createWorkspace().table.columns,
                            { id: "appointmentWindow", label: "Janela", kind: "metric", valueType: "select", viewIds: ["follow-up"], editableField: "workspace.niche.appointmentWindow", options: [{ value: "Hoje", label: "Hoje" }, { value: "24h", label: "24h" }] },
                        ],
                        records: [createRecord({
                            extensionValues: {
                                ...createRecord().extensionValues,
                                appointmentWindow: "Hoje",
                            },
                            boardColumnByView: {
                                ...createRecord().boardColumnByView,
                                "follow-up": "high",
                            },
                        })],
                    },
                    views: {
                        defaultViewId: "follow-up",
                        presets: [
                            {
                                id: "follow-up",
                                kind: "system",
                                baseViewId: "follow-up",
                                label: "Aguardando follow-up",
                                description: "Fila critica",
                                defaultMode: "board",
                                sortId: "priority-desc",
                                columnIds: ["company", "priority", "appointmentWindow"],
                            },
                        ],
                        saved: [],
                        system: [
                            {
                                id: "follow-up",
                                kind: "system",
                                baseViewId: "follow-up",
                                label: "Aguardando follow-up",
                                description: "Fila critica",
                                defaultMode: "board",
                                sortId: "priority-desc",
                                columnIds: ["company", "priority", "appointmentWindow"],
                            },
                        ],
                        sortOptions: createWorkspace().views.sortOptions,
                        saveScopes: createWorkspace().views.saveScopes,
                    },
                    board: {
                        columns: createWorkspace().board.columns,
                        columnsByView: {
                            ...createWorkspace().board.columnsByView,
                            "follow-up": [{ id: "high", label: "Alta", description: "1 registro com prioridade alta", tone: "warning" }],
                        },
                    },
                    editable: {
                        ...createWorkspace().editable,
                        detailEditors: [
                            ...createWorkspace().editable.detailEditors,
                            { id: "appointmentWindow", field: "workspace.niche.appointmentWindow", columnId: "appointmentWindow", label: "Janela", valueType: "select", options: [{ value: "Hoje", label: "Hoje" }, { value: "24h", label: "24h" }], section: "niche" },
                        ],
                    },
                }),
                filteredRecords: [createRecord({
                    extensionValues: {
                        ...createRecord().extensionValues,
                        appointmentWindow: "Hoje",
                    },
                    boardColumnByView: {
                        ...createRecord().boardColumnByView,
                        "follow-up": "high",
                    },
                })],
                visibleColumns: [
                    { id: "company", label: "Conta", kind: "text", valueType: "text", viewIds: ["follow-up"] },
                    { id: "priority", label: "Prioridade", kind: "text", valueType: "select", viewIds: ["follow-up"], editableField: "workspace.priority", options: [{ value: "high", label: "Alta" }] },
                    { id: "appointmentWindow", label: "Janela", kind: "metric", valueType: "select", viewIds: ["follow-up"], editableField: "workspace.niche.appointmentWindow", options: [{ value: "Hoje", label: "Hoje" }, { value: "24h", label: "24h" }] },
                ],
                allowedColumns: [
                    { id: "company", label: "Conta", kind: "text", valueType: "text", viewIds: ["follow-up"] },
                    { id: "priority", label: "Prioridade", kind: "text", valueType: "select", viewIds: ["follow-up"], editableField: "workspace.priority", options: [{ value: "high", label: "Alta" }] },
                    { id: "appointmentWindow", label: "Janela", kind: "metric", valueType: "select", viewIds: ["follow-up"], editableField: "workspace.niche.appointmentWindow", options: [{ value: "Hoje", label: "Hoje" }, { value: "24h", label: "24h" }] },
                ],
                visibleColumnIds: ["company", "priority", "appointmentWindow"],
                selectedView: {
                    id: "follow-up",
                    kind: "system",
                    baseViewId: "follow-up",
                    label: "Aguardando follow-up",
                    description: "Fila critica",
                    defaultMode: "board",
                    sortId: "priority-desc",
                    columnIds: ["company", "priority", "appointmentWindow"],
                },
                search: "",
                viewMode: "board",
                selectedId: "assessment-1",
                selectedIds: ["assessment-1"],
                activeSortId: "priority-desc",
                detail: createDetail({
                    nicheValues: { appointmentWindow: "Hoje" },
                    editableValues: {
                        ...createDetail().editableValues,
                        appointmentWindow: "Hoje",
                    },
                }),
                detailLoading: false,
                detailError: null,
                workspaceNotice: null,
                pendingMutationKey: null,
                bulkDefinition: createWorkspace().editable.bulkActions[0],
                bulkValue: "high",
                bulkPending: false,
                playbookPending: false,
                saveViewName: "",
                saveViewScope: "user",
                saveViewPending: false,
                workflowShortcuts: createWorkspace().shortcuts.byView["follow-up"],
                viewPlaybooks: createWorkspace().automation.playbooksByView["follow-up"],
                detailRecommendations: createDetail().recommendations,
            }),
        );

        expect(html).toContain("Workflow operacional");
        expect(html).toContain("Campos do nicho");
        expect(html).toContain("Hoje");
        expect(html).toContain("1 registro com prioridade alta");
    });
});
