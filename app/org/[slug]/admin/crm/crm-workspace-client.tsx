"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
    CrmBulkEditableField,
    CrmEditableField,
    CrmPlaybookId,
    CrmRecordDetailModel,
    CrmViewScope,
    CrmViewSortId,
    CrmWorkspaceRecord,
    OperatorCrmWorkspaceModel,
} from "@/lib/operator/crm-workspace";

import { CrmWorkspaceView } from "./_components/crm-workspace-view";

type InlinePatchPayload = {
    field: CrmEditableField;
    value: string;
};

type BulkPatchPayload = {
    assessmentIds: string[];
    field: CrmBulkEditableField;
    value: string;
};

type WorkspaceNotice = {
    tone: "positive" | "warning" | "critical";
    message: string;
} | null;

type ApiEnvelope<T> = {
    success?: boolean;
    data?: T;
    error?: string;
    message?: string;
};

type BulkResult = {
    field: CrmBulkEditableField;
    value: string;
    totalRequested: number;
    successCount: number;
    failureCount: number;
    results: Array<{
        assessmentId: string;
        success: boolean;
        result?: {
            assessmentId: string;
            field: CrmEditableField;
            value: string;
        };
        error?: string;
    }>;
};

type PlaybookResult = {
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
};

function formatLifecycleLabel(value: string) {
    return value.split("_").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}

function formatDateTimeLabel(value: string) {
    try {
        return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
    } catch {
        return value || "-";
    }
}

function resolveNicheFieldId(field: CrmEditableField) {
    return field.startsWith("workspace.niche.") ? field.replace("workspace.niche.", "") : null;
}

function patchDetailItems(
    items: CrmRecordDetailModel["overview"]["items"],
    fieldId: string,
    value: string,
) {
    return items.map((item) => (
        item.id === fieldId ? { ...item, value: value || "-" } : item
    ));
}

function applyInlinePatchLocal(
    records: CrmWorkspaceRecord[],
    patch: { assessmentId: string; field: CrmEditableField; value: string; stageLabel?: string | null; ownerLabel?: string | null; nextActionAtLabel?: string | null },
) {
    return records.map((record) => {
        if (record.id !== patch.assessmentId) return record;
        if (patch.field === "assessment.status") {
            return { ...record, status: patch.value };
        }
        if (patch.field === "contact.lifecycle") {
            return { ...record, contactLifecycle: patch.value };
        }
        if (patch.field === "conversation.assignedUserId") {
            return { ...record, ownerUserId: patch.value || null, ownerLabel: patch.ownerLabel ?? "Sem responsavel" };
        }
        if (patch.field === "workspace.priority") {
            return {
                ...record,
                priority: patch.value,
                boardColumnByView: {
                    ...record.boardColumnByView,
                    "follow-up": patch.value,
                },
            };
        }
        if (patch.field === "workspace.nextAction") {
            return { ...record, nextAction: patch.value };
        }
        if (patch.field === "workspace.nextActionAt") {
            return {
                ...record,
                nextActionAt: patch.value || null,
                nextActionAtLabel: patch.nextActionAtLabel ?? (patch.value ? formatDateTimeLabel(patch.value) : "-"),
            };
        }
        if (
            patch.field === "assessment.segment"
            || patch.field === "assessment.urgency"
            || patch.field === "assessment.goal"
            || resolveNicheFieldId(patch.field)
        ) {
            const fieldId = patch.field === "assessment.segment"
                ? "segment"
                : patch.field === "assessment.urgency"
                    ? "urgency"
                    : patch.field === "assessment.goal"
                        ? "goal"
                        : resolveNicheFieldId(patch.field)!;

            return {
                ...record,
                extensionValues: {
                    ...record.extensionValues,
                    [fieldId]: patch.value,
                },
            };
        }

        return {
            ...record,
            dealStageId: patch.value,
            dealStageLabel: patch.stageLabel ?? record.dealStageLabel,
            boardColumnId: patch.value || "no-deal",
            boardColumnByView: {
                ...record.boardColumnByView,
                all: patch.value || "no-deal",
                pipeline: patch.value || "no-deal",
            },
            hasDeal: true,
        };
    });
}

function patchDetailLocal(
    detail: CrmRecordDetailModel | null,
    patch: { field: CrmEditableField; value: string; stageLabel?: string | null; ownerLabel?: string | null; nextActionAtLabel?: string | null },
) {
    if (!detail) return detail;

    if (patch.field === "assessment.status") {
        return {
            ...detail,
            status: patch.value,
            editableValues: {
                ...detail.editableValues,
                status: patch.value,
            },
            badges: detail.badges.map((badge) => (
                badge.id === "status" ? { ...badge, label: patch.value } : badge
            )),
        };
    }

    if (patch.field === "contact.lifecycle") {
        return {
            ...detail,
            contactLifecycle: patch.value,
            editableValues: {
                ...detail.editableValues,
                lifecycle: patch.value,
            },
            badges: detail.badges.map((badge) => (
                badge.id === "lifecycle" ? { ...badge, label: formatLifecycleLabel(patch.value) } : badge
            )),
        };
    }

    if (patch.field === "conversation.assignedUserId") {
        return {
            ...detail,
            ownerUserId: patch.value || null,
            ownerLabel: patch.ownerLabel ?? "Sem responsavel",
            editableValues: {
                ...detail.editableValues,
                owner: patch.value || "",
            },
            overview: {
                ...detail.overview,
                items: patchDetailItems(detail.overview.items, "owner", patch.ownerLabel ?? "Sem responsavel"),
            },
        };
    }

    if (patch.field === "proposal.status") {
        return {
            ...detail,
            badges: detail.badges.map((badge) => (badge.id === "status" ? { ...badge, label: patch.value } : badge)),
            recommendations: detail.recommendations,
            quickActions: detail.quickActions,
            overview: {
                ...detail.overview,
            },
        };
    }

    if (patch.field === "workspace.priority") {
        return {
            ...detail,
            priority: patch.value,
            editableValues: {
                ...detail.editableValues,
                priority: patch.value,
            },
            badges: detail.badges.map((badge) => (
                badge.id === "priority" ? { ...badge, label: `Prioridade ${patch.value}` } : badge
            )),
            overview: {
                ...detail.overview,
                items: patchDetailItems(detail.overview.items, "priority", patch.value),
            },
        };
    }

    if (patch.field === "workspace.nextAction") {
        return {
            ...detail,
            nextAction: patch.value,
            editableValues: {
                ...detail.editableValues,
                nextAction: patch.value,
            },
            overview: {
                ...detail.overview,
                items: patchDetailItems(detail.overview.items, "nextAction", patch.value),
            },
        };
    }

    if (patch.field === "workspace.nextActionAt") {
        return {
            ...detail,
            nextActionAt: patch.value || null,
            nextActionAtLabel: patch.nextActionAtLabel ?? (patch.value ? formatDateTimeLabel(patch.value) : "-"),
            editableValues: {
                ...detail.editableValues,
                nextActionAt: patch.value || "",
            },
            overview: {
                ...detail.overview,
                items: patchDetailItems(detail.overview.items, "nextActionAt", patch.nextActionAtLabel ?? (patch.value ? formatDateTimeLabel(patch.value) : "-")),
            },
        };
    }

    if (patch.field === "assessment.segment") {
        return {
            ...detail,
            segment: patch.value,
            editableValues: {
                ...detail.editableValues,
                segment: patch.value,
            },
            overview: {
                ...detail.overview,
                items: patchDetailItems(detail.overview.items, "segment", patch.value),
            },
        };
    }

    if (patch.field === "assessment.urgency") {
        return {
            ...detail,
            urgency: patch.value,
            editableValues: {
                ...detail.editableValues,
                urgency: patch.value,
            },
            overview: {
                ...detail.overview,
                items: patchDetailItems(detail.overview.items, "urgency", patch.value),
            },
        };
    }

    if (patch.field === "assessment.goal") {
        return {
            ...detail,
            goal: patch.value,
            editableValues: {
                ...detail.editableValues,
                goal: patch.value,
            },
            overview: {
                ...detail.overview,
                items: patchDetailItems(detail.overview.items, "goal", patch.value),
            },
        };
    }

    const nicheFieldId = resolveNicheFieldId(patch.field);
    if (nicheFieldId) {
        return {
            ...detail,
            nicheValues: {
                ...detail.nicheValues,
                [nicheFieldId]: patch.value,
            },
            editableValues: {
                ...detail.editableValues,
                [nicheFieldId]: patch.value,
            },
            nicheSections: detail.nicheSections.map((section) => ({
                ...section,
                items: patchDetailItems(section.items, nicheFieldId, patch.value),
            })),
        };
    }

    return {
        ...detail,
        dealStageId: patch.value,
        dealStageLabel: patch.stageLabel ?? detail.dealStageLabel,
        editableValues: {
            ...detail.editableValues,
            stage: patch.value,
        },
        badges: detail.badges.map((badge) => (
            badge.id === "stage"
                ? { ...badge, label: patch.stageLabel ?? detail.dealStageLabel }
                : badge
        )),
    };
}

async function readApiData<T>(response: Response, fallbackMessage: string): Promise<T> {
    const payload = await response.json().catch(() => ({})) as ApiEnvelope<T>;
    if (!response.ok) {
        throw new Error(payload.message || payload.error || fallbackMessage);
    }

    if (payload && typeof payload === "object" && "success" in payload && "data" in payload) {
        return payload.data as T;
    }

    return payload as T;
}

function filterRecords(records: CrmWorkspaceRecord[], viewId: string, search: string) {
    const normalizedSearch = search.trim().toLowerCase();

    return records.filter((record) => {
        if (viewId && !record.viewIds.includes(viewId as any)) return false;

        if (!normalizedSearch) return true;

        const haystack = [
            record.company,
            record.primaryContact,
            record.email,
            record.phone,
            record.status,
            record.contactLifecycle,
            record.ownerLabel,
            record.priority,
            record.nextAction,
            record.nextActionAtLabel,
            record.proposalLabel,
            record.dealStageLabel,
            record.cadenceLabel,
            record.recommendedActionLabel,
            ...record.tags,
            ...Object.values(record.extensionValues),
        ].join(" ").toLowerCase();

        return haystack.includes(normalizedSearch);
    });
}

function sortRecords(records: CrmWorkspaceRecord[], sortId: CrmViewSortId) {
    const priorityOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
    };

    return [...records].sort((left, right) => {
        if (sortId === "priority-desc") {
            return (priorityOrder[left.priority] ?? 99) - (priorityOrder[right.priority] ?? 99);
        }

        if (sortId === "last-touch-asc") {
            return new Date(left.lastTouchAt).getTime() - new Date(right.lastTouchAt).getTime();
        }

        if (sortId === "next-meeting-asc") {
            const leftParsed = left.nextMeetingLabel === "Sem agenda" ? Number.NaN : Date.parse(left.nextMeetingLabel);
            const rightParsed = right.nextMeetingLabel === "Sem agenda" ? Number.NaN : Date.parse(right.nextMeetingLabel);
            const leftMeeting = Number.isNaN(leftParsed) ? Number.MAX_SAFE_INTEGER : leftParsed;
            const rightMeeting = Number.isNaN(rightParsed) ? Number.MAX_SAFE_INTEGER : rightParsed;
            return leftMeeting - rightMeeting;
        }

        if (sortId === "company-asc") {
            return left.company.localeCompare(right.company, "pt-BR");
        }

        return new Date(right.lastTouchAt).getTime() - new Date(left.lastTouchAt).getTime();
    });
}

function buildColumnState(data: OperatorCrmWorkspaceModel) {
    return Object.fromEntries(data.views.presets.map((preset) => [preset.id, preset.columnIds])) as Record<string, string[]>;
}

function buildSortState(data: OperatorCrmWorkspaceModel) {
    return Object.fromEntries(data.views.presets.map((preset) => [preset.id, preset.sortId])) as Record<string, CrmViewSortId>;
}

function dataColumns(data: OperatorCrmWorkspaceModel, columnIds: string[]) {
    if (columnIds.length === 0) return data.table.columns;
    const columnSet = new Set(columnIds);
    return data.table.columns.filter((column) => columnSet.has(column.id));
}

function resolveBulkDefinition(data: OperatorCrmWorkspaceModel, field: CrmBulkEditableField) {
    return data.editable.bulkActions.find((action) => action.field === field) ?? data.editable.bulkActions[0];
}

export function CrmWorkspaceClient({
    slug,
    initialData,
    initialDetail,
}: {
    slug: string;
    initialData: OperatorCrmWorkspaceModel;
    initialDetail: CrmRecordDetailModel | null;
}) {
    const router = useRouter();
    const [records, setRecords] = useState(initialData.table.records);
    const [selectedViewId, setSelectedViewId] = useState<string>(initialData.views.defaultViewId);
    const [columnIdsByView, setColumnIdsByView] = useState<Record<string, string[]>>(() => buildColumnState(initialData));
    const [sortIdByView, setSortIdByView] = useState<Record<string, CrmViewSortId>>(() => buildSortState(initialData));
    const initialSelectedView = initialData.views.presets.find((preset) => preset.id === initialData.views.defaultViewId) ?? initialData.views.presets[0];
    const [viewMode, setViewMode] = useState<"table" | "board">(initialSelectedView?.defaultMode ?? "table");
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
    const [selectedId, setSelectedId] = useState<string | null>(initialDetail?.id ?? initialData.table.records[0]?.id ?? null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [detailCache, setDetailCache] = useState<Record<string, CrmRecordDetailModel>>(
        initialDetail ? { [initialDetail.id]: initialDetail } : {},
    );
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [pendingMutationKey, setPendingMutationKey] = useState<string | null>(null);
    const [workspaceNotice, setWorkspaceNotice] = useState<WorkspaceNotice>(null);
    const [bulkDraft, setBulkDraft] = useState<{ field: CrmBulkEditableField; value: string }>({
        field: initialData.editable.bulkActions[0]?.field ?? "workspace.priority",
        value: "",
    });
    const [bulkPending, setBulkPending] = useState(false);
    const [playbookPending, setPlaybookPending] = useState(false);
    const [savedViewName, setSavedViewName] = useState("");
    const [savedViewScope, setSavedViewScope] = useState<CrmViewScope>("user");
    const [saveViewPending, setSaveViewPending] = useState(false);
    const [, startTransition] = useTransition();
    const cachedSelectedDetail = selectedId ? detailCache[selectedId] : undefined;

    const selectedView = initialData.views.presets.find((preset) => preset.id === selectedViewId) ?? initialData.views.presets[0];
    const activeSortId = selectedView ? (sortIdByView[selectedView.id] ?? selectedView.sortId) : "last-touch-desc";
    const visibleColumnIds = selectedView ? (columnIdsByView[selectedView.id] ?? selectedView.columnIds) : [];
    const visibleColumns = dataColumns(initialData, visibleColumnIds);
    const allowedColumns = selectedView
        ? initialData.table.columns.filter((column) => column.viewIds.includes(selectedView.baseViewId))
        : initialData.table.columns;
    const filteredRecords = sortRecords(
        filterRecords(records, selectedView?.baseViewId ?? "all", deferredSearch),
        activeSortId,
    );
    const selectedDetail = selectedId ? detailCache[selectedId] ?? null : null;
    const bulkDefinition = resolveBulkDefinition(initialData, bulkDraft.field);
    const shortcutActions = selectedView ? initialData.shortcuts.byView[selectedView.baseViewId] ?? [] : [];
    const viewPlaybooks = selectedView ? initialData.automation.playbooksByView[selectedView.baseViewId] ?? [] : [];

    useEffect(() => {
        setRecords(initialData.table.records);
        setColumnIdsByView((current) => ({ ...buildColumnState(initialData), ...current }));
        setSortIdByView((current) => ({ ...buildSortState(initialData), ...current }));
    }, [initialData.generatedAt]);

    useEffect(() => {
        if (!selectedView) return;
        setViewMode(selectedView.defaultMode);
    }, [selectedView?.defaultMode]);

    useEffect(() => {
        if (!initialData.views.presets.some((preset) => preset.id === selectedViewId)) {
            setSelectedViewId(initialData.views.defaultViewId);
        }
    }, [initialData.generatedAt, initialData.views.defaultViewId, initialData.views.presets, selectedViewId]);

    useEffect(() => {
        const visibleIds = new Set(filteredRecords.map((record) => record.id));
        setSelectedIds((current) => current.filter((assessmentId) => visibleIds.has(assessmentId)));
    }, [filteredRecords]);

    useEffect(() => {
        if (!selectedId || cachedSelectedDetail) return;

        let active = true;
        setDetailLoading(true);
        setDetailError(null);

        fetch(`/api/org/${slug}/crm/records/${selectedId}`)
            .then((response) => readApiData<CrmRecordDetailModel>(response, "Failed to load CRM detail"))
            .then((data) => {
                if (!active) return;
                setDetailCache((current) => ({ ...current, [data.id]: data }));
            })
            .catch((error) => {
                if (!active) return;
                setDetailError(error instanceof Error ? error.message : "Failed to load CRM detail");
            })
            .finally(() => {
                if (active) setDetailLoading(false);
            });

        return () => {
            active = false;
        };
    }, [cachedSelectedDetail, selectedId, slug]);

    useEffect(() => {
        if (selectedId) return;
        if (filteredRecords[0]?.id) {
            setSelectedId(filteredRecords[0].id);
        }
    }, [filteredRecords, selectedId]);

    function resolvePatchLabels(field: CrmEditableField, value: string) {
        const stageLabel = field === "deal.stageId"
            ? initialData.editable.dealStage.find((option) => option.value === value)?.label ?? null
            : null;
        const ownerLabel = field === "conversation.assignedUserId"
            ? initialData.editable.owner.find((option) => option.value === value)?.label ?? "Sem responsavel"
            : null;
        const nextActionAtLabel = field === "workspace.nextActionAt"
            ? (value ? formatDateTimeLabel(value) : "-")
            : null;

        return {
            stageLabel,
            ownerLabel,
            nextActionAtLabel,
        };
    }

    async function handleInlineChange(assessmentId: string, payload: InlinePatchPayload) {
        const mutationKey = `${assessmentId}:${payload.field}`;
        const previousRecords = records;
        const previousDetail = selectedId ? detailCache[selectedId] ?? null : null;
        const labels = resolvePatchLabels(payload.field, payload.value);

        setWorkspaceNotice(null);
        setPendingMutationKey(mutationKey);
        setRecords((current) => applyInlinePatchLocal(current, {
            assessmentId,
            field: payload.field,
            value: payload.value,
            ...labels,
        }));

        if (selectedId === assessmentId) {
            setDetailCache((current) => {
                const currentDetail = current[assessmentId];
                if (!currentDetail) return current;

                return {
                    ...current,
                    [assessmentId]: patchDetailLocal(currentDetail, {
                        field: payload.field,
                        value: payload.value,
                        ...labels,
                    }) as CrmRecordDetailModel,
                };
            });
        }

        try {
            const response = await fetch(`/api/org/${slug}/crm/records/${assessmentId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            await readApiData(response, "Failed to update CRM record");
            startTransition(() => router.refresh());
        } catch (error) {
            setRecords(previousRecords);
            if (selectedId === assessmentId && previousDetail) {
                setDetailCache((current) => ({
                    ...current,
                    [assessmentId]: previousDetail,
                }));
            }
            setWorkspaceNotice({
                tone: "critical",
                message: error instanceof Error ? error.message : "Failed to update CRM record",
            });
        } finally {
            setPendingMutationKey(null);
        }
    }

    function applySuccessfulBulkResults(result: BulkResult) {
        const successfulResults = result.results.filter((item) => item.success && item.result?.field && item.result.value);
        if (successfulResults.length === 0) return;

        setRecords((current) => successfulResults.reduce((nextRecords, item) => {
            const labels = resolvePatchLabels(item.result!.field, item.result!.value);
            return applyInlinePatchLocal(nextRecords, {
                assessmentId: item.assessmentId,
                field: item.result!.field,
                value: item.result!.value,
                ...labels,
            });
        }, current));

        setDetailCache((current) => {
            const nextCache = { ...current };
            for (const item of successfulResults) {
                const currentDetail = nextCache[item.assessmentId];
                if (!currentDetail) continue;
                const labels = resolvePatchLabels(item.result!.field, item.result!.value);
                nextCache[item.assessmentId] = patchDetailLocal(currentDetail, {
                    field: item.result!.field,
                    value: item.result!.value,
                    ...labels,
                }) as CrmRecordDetailModel;
            }
            return nextCache;
        });
    }

    async function handleBulkApply(payload?: Partial<BulkPatchPayload>) {
        const field = payload?.field ?? bulkDraft.field;
        const value = payload?.value ?? bulkDraft.value;
        const assessmentIds = payload?.assessmentIds ?? selectedIds;

        if (assessmentIds.length === 0) {
            setWorkspaceNotice({
                tone: "warning",
                message: "Selecione pelo menos um registro para executar a acao em lote.",
            });
            return;
        }

        if (!value && !["conversation.assignedUserId", "workspace.nextActionAt"].includes(field)) {
            setWorkspaceNotice({
                tone: "warning",
                message: "Defina um valor valido para a acao em lote.",
            });
            return;
        }

        setWorkspaceNotice(null);
        setBulkPending(true);
        setPendingMutationKey(`bulk:${field}`);

        try {
            const response = await fetch(`/api/org/${slug}/crm/bulk`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    assessmentIds,
                    field,
                    value,
                }),
            });

            const result = await readApiData<BulkResult>(response, "Failed to run CRM bulk action");
            applySuccessfulBulkResults(result);
            setWorkspaceNotice({
                tone: result.failureCount > 0 ? "warning" : "positive",
                message: result.failureCount > 0
                    ? `${result.successCount} registros atualizados e ${result.failureCount} falharam.`
                    : `${result.successCount} registros atualizados com sucesso.`,
            });
            startTransition(() => router.refresh());
        } catch (error) {
            setWorkspaceNotice({
                tone: "critical",
                message: error instanceof Error ? error.message : "Failed to run CRM bulk action",
            });
        } finally {
            setBulkPending(false);
            setPendingMutationKey(null);
        }
    }

    async function handleSaveView() {
        if (!selectedView) return;
        if (!savedViewName.trim()) {
            setWorkspaceNotice({
                tone: "warning",
                message: "Defina um nome para salvar a view atual.",
            });
            return;
        }

        setWorkspaceNotice(null);
        setSaveViewPending(true);

        try {
            const response = await fetch(`/api/org/${slug}/crm/views`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: savedViewName,
                    scope: savedViewScope,
                    baseViewId: selectedView.baseViewId,
                    defaultMode: viewMode,
                    sortId: activeSortId,
                    columnIds: visibleColumnIds,
                }),
            });

            await readApiData(response, "Failed to save CRM view");
            setSavedViewName("");
            setWorkspaceNotice({
                tone: "positive",
                message: "View salva com sucesso.",
            });
            startTransition(() => router.refresh());
        } catch (error) {
            setWorkspaceNotice({
                tone: "critical",
                message: error instanceof Error ? error.message : "Failed to save CRM view",
            });
        } finally {
            setSaveViewPending(false);
        }
    }

    async function handlePlaybook(playbookId: CrmPlaybookId, assessmentIds?: string[]) {
        const targetIds = assessmentIds && assessmentIds.length > 0
            ? assessmentIds
            : selectedIds.length > 0
                ? selectedIds
                : selectedId
                    ? [selectedId]
                    : [];

        if (targetIds.length === 0) {
            setWorkspaceNotice({
                tone: "warning",
                message: "Selecione pelo menos um registro para executar o playbook.",
            });
            return;
        }

        setWorkspaceNotice(null);
        setPlaybookPending(true);
        setPendingMutationKey(`playbook:${playbookId}`);

        try {
            const response = await fetch(`/api/org/${slug}/crm/playbooks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    assessmentIds: targetIds,
                    playbookId,
                    sourceViewId: selectedView?.baseViewId ?? null,
                }),
            });

            const result = await readApiData<PlaybookResult>(response, "Failed to execute CRM playbook");

            setDetailCache((current) => {
                const nextCache = { ...current };
                for (const item of result.results) {
                    delete nextCache[item.assessmentId];
                }
                return nextCache;
            });

            setWorkspaceNotice({
                tone: result.failureCount > 0 ? "warning" : "positive",
                message: result.failureCount > 0
                    ? `${result.successCount} registros automatizados e ${result.failureCount} falharam.`
                    : `${result.successCount} registros automatizados com sucesso.`,
            });
            startTransition(() => router.refresh());
        } catch (error) {
            setWorkspaceNotice({
                tone: "critical",
                message: error instanceof Error ? error.message : "Failed to execute CRM playbook",
            });
        } finally {
            setPlaybookPending(false);
            setPendingMutationKey(null);
        }
    }

    function toggleRecordSelection(assessmentId: string) {
        setSelectedIds((current) => {
            if (current.includes(assessmentId)) {
                return current.filter((currentId) => currentId !== assessmentId);
            }
            if (current.length >= initialData.shortcuts.selectionLimit) {
                setWorkspaceNotice({
                    tone: "warning",
                    message: `Selecao limitada a ${initialData.shortcuts.selectionLimit} registros por lote.`,
                });
                return current;
            }
            return [...current, assessmentId];
        });
    }

    function selectVisibleRecords() {
        setSelectedIds(filteredRecords.slice(0, initialData.shortcuts.selectionLimit).map((record) => record.id));
    }

    function toggleColumn(columnId: string) {
        if (!selectedView || columnId === "company") return;

        setColumnIdsByView((current) => {
            const currentColumnIds = current[selectedView.id] ?? selectedView.columnIds;
            const hasColumn = currentColumnIds.includes(columnId);
            const nextColumnIds = hasColumn
                ? currentColumnIds.filter((currentId) => currentId !== columnId)
                : [...currentColumnIds, columnId];

            if (nextColumnIds.length === 0) return current;

            return {
                ...current,
                [selectedView.id]: nextColumnIds,
            };
        });
    }

    return (
        <CrmWorkspaceView
            slug={slug}
            data={{
                ...initialData,
                table: {
                    ...initialData.table,
                    records,
                },
            }}
            filteredRecords={filteredRecords}
            visibleColumns={visibleColumns}
            allowedColumns={allowedColumns}
            visibleColumnIds={visibleColumnIds}
            selectedView={selectedView}
            search={search}
            viewMode={viewMode}
            selectedId={selectedId}
            selectedIds={selectedIds}
            activeSortId={activeSortId}
            detail={selectedDetail}
            detailLoading={detailLoading}
            detailError={detailError}
            workspaceNotice={workspaceNotice}
            pendingMutationKey={pendingMutationKey}
            bulkDefinition={bulkDefinition}
            bulkValue={bulkDraft.value}
            bulkPending={bulkPending}
            playbookPending={playbookPending}
            saveViewName={savedViewName}
            saveViewScope={savedViewScope}
            saveViewPending={saveViewPending}
            workflowShortcuts={shortcutActions}
            viewPlaybooks={viewPlaybooks}
            detailRecommendations={selectedDetail?.recommendations ?? []}
            onSearchChange={setSearch}
            onViewChange={setSelectedViewId}
            onViewModeChange={setViewMode}
            onViewSortChange={(sortId) => {
                if (!selectedView) return;
                setSortIdByView((current) => ({ ...current, [selectedView.id]: sortId }));
            }}
            onSelectRecord={setSelectedId}
            onToggleRecordSelection={toggleRecordSelection}
            onSelectVisible={selectVisibleRecords}
            onClearSelection={() => setSelectedIds([])}
            onToggleColumn={toggleColumn}
            onInlineChange={handleInlineChange}
            onBulkFieldChange={(field) => setBulkDraft({ field, value: "" })}
            onBulkValueChange={(value) => setBulkDraft((current) => ({ ...current, value }))}
            onBulkApply={() => handleBulkApply()}
            onWorkflowShortcut={(shortcut) => setBulkDraft({ field: shortcut.field, value: shortcut.suggestedValue })}
            onRunPlaybook={(playbookId) => handlePlaybook(playbookId)}
            onRunRecommendation={(playbookId) => handlePlaybook(playbookId, selectedId ? [selectedId] : [])}
            onSaveViewNameChange={setSavedViewName}
            onSaveViewScopeChange={setSavedViewScope}
            onSaveView={handleSaveView}
        />
    );
}
