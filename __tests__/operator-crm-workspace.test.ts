import {
    applyCrmInlinePatch,
    buildCrmRecordQuickActions,
    buildCrmBoardColumns,
    buildOperatorCrmWorkspaceModel,
    composeCrmRecordTimeline,
    resolveCrmNicheDefinition,
    type CrmWorkspaceRecord,
} from "../lib/operator/crm-workspace";

function createRecord(overrides: Partial<CrmWorkspaceRecord> = {}): CrmWorkspaceRecord {
    return {
        id: "assessment-1",
        company: "Acme",
        primaryContact: "Ana",
        email: "ana@acme.com",
        phone: "+5511999999999",
        status: "Novo",
        contactLifecycle: "lead",
        dealStageId: null,
        dealStageLabel: "Sem deal",
        proposalStatus: "none",
        proposalLabel: "Sem proposta",
        scoreLabel: "72",
        lastTouchAt: "2026-03-16T12:00:00.000Z",
        lastTouchLabel: "16/03/2026 12:00",
        nextMeetingLabel: "Sem agenda",
        unreadCount: 0,
        activityCount: 0,
        tags: [],
        tone: "neutral",
        boardColumnId: "no-deal",
        boardColumnByView: {
            all: "no-deal",
            pipeline: "no-deal",
            "follow-up": "medium",
        },
        conversationId: null,
        ownerUserId: null,
        ownerLabel: "Sem responsavel",
        priority: "medium",
        nextAction: "Qualificar lead",
        nextActionAt: null,
        nextActionAtLabel: "-",
        cadenceLabel: "-",
        recommendedActionLabel: "Executar follow-up inicial",
        needsAttention: true,
        hasDeal: false,
        hasConversation: false,
        viewIds: ["all", "follow-up"],
        extensionValues: {
            monthlyRevenue: "R$ 25.000",
            monthlyLeads: "40",
            conversionRate: "12%",
        },
        ...overrides,
    };
}

describe("operator CRM workspace", () => {
    test("resolves niche metadata from tenant industry", () => {
        expect(resolveCrmNicheDefinition("Retail ecommerce")).toMatchObject({
            key: "commerce",
            label: "Commerce CRM",
        });
        expect(resolveCrmNicheDefinition("Escritorio juridico")).toMatchObject({
            key: "legal",
            label: "Legal CRM",
        });
        expect(resolveCrmNicheDefinition("Clinica odontologica")).toMatchObject({
            key: "healthcare",
            editableFieldIds: ["appointmentWindow", "procedureType", "insuranceType"],
        });
    });

    test("builds an honest workspace model with warnings and metrics", () => {
        const model = buildOperatorCrmWorkspaceModel({
            orgSlug: "acme",
            orgName: "Acme",
            industry: "Services",
            records: [createRecord({ dealStageId: "stage-1", dealStageLabel: "Contato", boardColumnId: "stage-1", hasDeal: true, needsAttention: false })],
            stageOptions: [{ value: "stage-1", label: "Contato" }],
            ownerOptions: [{ value: "", label: "Sem responsavel" }],
        });

        expect(model.summary.headline).toContain("Acme");
        expect(model.summary.metrics.some((metric) => metric.id === "pipeline")).toBe(true);
        expect(model.table.columns.some((column) => column.id === "status")).toBe(true);
        expect(model.board.columns.some((column) => column.id === "stage-1")).toBe(true);
        expect(model.views.presets.some((preset) => preset.id === "follow-up")).toBe(true);
        expect(model.views.presets.find((preset) => preset.id === "follow-up")?.columnIds).toEqual(
            expect.arrayContaining(["goal", "urgency"]),
        );
        expect(model.board.columnsByView["follow-up"].map((column) => column.id)).toEqual(
            expect.arrayContaining(["critical", "high", "medium", "low"]),
        );
        expect(model.views.presets.some((preset) => preset.id === "revenue-risk")).toBe(true);
        expect(model.views.presets.some((preset) => preset.id === "proposals")).toBe(true);
        expect(model.summary.metrics.some((metric) => metric.id === "revenue-risk")).toBe(true);
        expect(model.summary.metrics.some((metric) => metric.id === "proposals")).toBe(true);
        expect(model.warnings).toHaveLength(0);
    });

    test("marks high-risk records with revenue-risk view", () => {
        const record = createRecord({
            proposalStatus: "sent",
            lastTouchAt: "2026-03-01T12:00:00.000Z",
            viewIds: ["all", "follow-up"],
        });

        const model = buildOperatorCrmWorkspaceModel({
            orgSlug: "acme",
            orgName: "Acme",
            industry: "Services",
            records: [record],
            stageOptions: [{ value: "stage-1", label: "Contato" }],
            ownerOptions: [{ value: "", label: "Sem responsavel" }],
        });

        expect(model.table.records[0].viewIds).toEqual(expect.arrayContaining(["revenue-risk"]));
    });

    test("marks proposal records in proposals view", () => {
        const record = createRecord({
            proposalStatus: "viewed",
            lastTouchAt: "2026-03-01T12:00:00.000Z",
            viewIds: ["all", "follow-up"],
        });

        const model = buildOperatorCrmWorkspaceModel({
            orgSlug: "acme",
            orgName: "Acme",
            industry: "Services",
            records: [record],
            stageOptions: [{ value: "stage-1", label: "Contato" }],
            ownerOptions: [{ value: "", label: "Sem responsavel" }],
        });

        expect(model.table.records[0].viewIds).toEqual(expect.arrayContaining(["proposals"]));
        expect(model.board.columnsByView.proposals.map((col) => col.id)).toEqual(expect.arrayContaining(["viewed"]));
    });

    test("builds closed select definitions for supported vertical fields", () => {
        const model = buildOperatorCrmWorkspaceModel({
            orgSlug: "clinic",
            orgName: "Clinic",
            industry: "Clinic",
            records: [createRecord()],
            stageOptions: [{ value: "stage-1", label: "Contato" }],
            ownerOptions: [{ value: "", label: "Sem responsavel" }],
        });

        const appointmentWindow = model.table.columns.find((column) => column.id === "appointmentWindow");
        const nicheEditor = model.editable.detailEditors.find((editor) => editor.columnId === "appointmentWindow");

        expect(appointmentWindow).toMatchObject({
            valueType: "select",
            editableField: "workspace.niche.appointmentWindow",
        });
        expect(appointmentWindow?.options?.map((option) => option.value)).toEqual(
            expect.arrayContaining(["Hoje", "24h", "48h"]),
        );
        expect(nicheEditor).toMatchObject({
            valueType: "select",
            section: "niche",
        });
    });

    test("exposes v4 operational controls for saved views, bulk actions and shortcuts", () => {
        const model = buildOperatorCrmWorkspaceModel({
            orgSlug: "acme",
            orgName: "Acme",
            industry: "Services",
            records: [createRecord()],
            stageOptions: [{ value: "stage-1", label: "Contato" }],
            ownerOptions: [{ value: "", label: "Sem responsavel" }, { value: "user-1", label: "closer@acme.com" }],
            savedViews: [
                {
                    id: "saved:follow-up-owner",
                    kind: "saved",
                    baseViewId: "follow-up",
                    label: "Minha fila",
                    description: "View salva",
                    defaultMode: "table",
                    sortId: "priority-desc",
                    scope: "user",
                    columnIds: ["company", "owner", "priority"],
                },
            ],
        });

        expect(model.views.saved[0]).toMatchObject({
            id: "saved:follow-up-owner",
            kind: "saved",
            baseViewId: "follow-up",
            scope: "user",
        });
        expect(model.views.sortOptions.map((option) => option.id)).toEqual(
            expect.arrayContaining(["priority-desc", "last-touch-desc"]),
        );
        expect(model.editable.bulkActions.map((action) => action.field)).toEqual(
            expect.arrayContaining(["workspace.priority", "deal.stageId", "workspace.nextAction"]),
        );
        expect(model.shortcuts.byView["follow-up"][0]).toMatchObject({
            field: "workspace.nextAction",
            suggestedValue: "Realizar follow-up",
        });
    });

    test("exposes v5 automations with cadence and recommendation columns", () => {
        const model = buildOperatorCrmWorkspaceModel({
            orgSlug: "acme",
            orgName: "Acme",
            industry: "Services",
            records: [createRecord()],
            stageOptions: [{ value: "stage-1", label: "Contato" }],
            ownerOptions: [{ value: "", label: "Sem responsavel" }],
        });

        expect(model.table.columns.map((column) => column.id)).toEqual(
            expect.arrayContaining(["cadence", "recommendation"]),
        );
        expect(model.automation.cadenceTemplates.map((template) => template.id)).toEqual(
            expect.arrayContaining(["initial-follow-up", "proposal-revival"]),
        );
        expect(model.automation.playbooksByView["follow-up"][0]).toMatchObject({
            id: "follow-up-initial",
            cadenceId: "initial-follow-up",
        });
    });

    test("composes a live record timeline with conversation and commercial events", () => {
        const timeline = composeCrmRecordTimeline({
            messages: [
                {
                    id: "msg-1",
                    direction: "inbound",
                    text: "Preciso de proposta ainda hoje",
                    statusLabel: "Recebida",
                    at: "2026-03-16T15:00:00.000Z",
                },
            ],
            activities: [
                {
                    id: "activity-1",
                    title: "stage changed",
                    detail: "Contato para proposta",
                    eyebrow: "activity",
                    at: "2026-03-16T12:00:00.000Z",
                    tone: "warning",
                },
            ],
            proposals: [
                {
                    id: "proposal-1",
                    title: "Proposta v2",
                    detail: "sent · R$ 10.000",
                    eyebrow: "sent",
                    at: "2026-03-16T14:00:00.000Z",
                    tone: "warning",
                },
            ],
            meetings: [],
        });

        expect(timeline.map((item) => item.kind)).toEqual(["message", "proposal", "activity"]);
        expect(timeline[0]).toMatchObject({
            title: "Mensagem recebida",
            tone: "warning",
        });
    });

    test("builds quick actions without opening a parallel inbox", () => {
        const actions = buildCrmRecordQuickActions({
            orgSlug: "acme",
            conversationId: "conv-1",
            nextAction: "Ligar para validar escopo",
            nextActionAt: "2026-03-17T14:00:00.000Z",
            recommendations: [
                {
                    id: "revive-stalled-proposal",
                    title: "Cobrar proposta parada",
                    reason: "A proposta esta sem resposta.",
                    playbookId: "revive-stalled-proposal",
                    actionLabel: "Cobrar proposta",
                },
            ],
            proposalPublicSlug: "prop-123",
            proposalStatus: "sent",
            hasDeal: true,
        });

        expect(actions.map((action) => action.id)).toEqual(
            expect.arrayContaining(["open-conversation", "persist-next-action", "playbook:revive-stalled-proposal", "open-proposal", "register-response", "follow-up", "mark-stalled", "mark-won", "mark-lost"]),
        );
        expect(actions.find((action) => action.id === "open-conversation")).toMatchObject({
            kind: "link",
            href: "/org/acme/admin/whatsapp?conversationId=conv-1",
        });
        expect(actions.find((action) => action.id === "register-response")).toMatchObject({
            kind: "inline-update",
            field: "workspace.nextAction",
        });
        expect(actions.find((action) => action.id === "mark-lost")).toMatchObject({
            kind: "inline-update",
            field: "proposal.status",
            value: "lost",
        });
    });

    test("keeps adaptive fallback when industry schema does not exist", () => {
        const model = buildOperatorCrmWorkspaceModel({
            orgSlug: "acme",
            orgName: "Acme",
            industry: "Unknown vertical",
            records: [createRecord()],
            stageOptions: [],
            ownerOptions: [{ value: "", label: "Sem responsavel" }],
        });

        expect(model.niche.key).toBe("general");
        expect(model.niche.tableFieldIds).toContain("segment");
        expect(model.warnings.length).toBeGreaterThan(0);
    });

    test("applies inline patches for lifecycle and stage without losing board state", () => {
        const patched = applyCrmInlinePatch(
            [createRecord()],
            {
                assessmentId: "assessment-1",
                field: "deal.stageId",
                value: "stage-2",
                stageLabel: "Proposta",
            },
        );

        expect(patched[0]).toMatchObject({
            dealStageId: "stage-2",
            dealStageLabel: "Proposta",
            boardColumnId: "stage-2",
            hasDeal: true,
        });
    });

    test("applies qualification patches into extension values without breaking record state", () => {
        const patched = applyCrmInlinePatch(
            [createRecord()],
            {
                assessmentId: "assessment-1",
                field: "assessment.goal",
                value: "Aumentar conversao",
            },
        );

        expect(patched[0]?.extensionValues.goal).toBe("Aumentar conversao");
        expect(patched[0]?.boardColumnId).toBe("no-deal");
    });

    test("applies proposal status patches and includes proposals view", () => {
        const patched = applyCrmInlinePatch(
            [createRecord({ proposalStatus: "sent", viewIds: ["all"] })],
            {
                assessmentId: "assessment-1",
                field: "proposal.status",
                value: "won",
            },
        );

        expect(patched[0]?.proposalStatus).toBe("won");
        expect(patched[0]?.viewIds).toEqual(expect.arrayContaining(["proposals"]));
    });

    test("builds board counts for no-deal and canonical stages", () => {
        const columns = buildCrmBoardColumns(
            [
                createRecord(),
                createRecord({ id: "assessment-2", boardColumnId: "stage-1", dealStageId: "stage-1", hasDeal: true }),
            ],
            [{ value: "stage-1", label: "Contato" }],
        );

        expect(columns[0].id).toBe("no-deal");
        expect(columns[0].description).toContain("1");
        expect(columns[1]).toMatchObject({
            id: "stage-1",
            label: "Contato",
        });
    });
});
