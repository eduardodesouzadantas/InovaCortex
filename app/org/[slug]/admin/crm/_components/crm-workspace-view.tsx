"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { KanbanSquare, LayoutList, MessageSquareText, Search, Sparkles } from "lucide-react";

import type {
    CrmBulkActionDefinition,
    CrmDetailEditorDefinition,
    CrmEditableField,
    CrmPlaybookDefinition,
    CrmRecordDetailModel,
    CrmRecommendedAction,
    CrmViewScope,
    CrmViewSortId,
    CrmWorkflowShortcut,
    CrmWorkspaceColumn,
    CrmWorkspaceRecord,
    OperatorCrmWorkspaceModel,
} from "@/lib/operator/crm-workspace";

function toneClasses(tone: "neutral" | "positive" | "warning" | "critical"): string {
    switch (tone) {
        case "positive":
            return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
        case "warning":
            return "border-amber-400/20 bg-amber-400/10 text-amber-100";
        case "critical":
            return "border-rose-400/20 bg-rose-400/10 text-rose-100";
        default:
            return "border-white/10 bg-white/[0.03] text-slate-100";
    }
}

function formatLifecycleLabel(value: string) {
    return value.split("_").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}

function formatAt(value: string) {
    try {
        return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
    } catch {
        return value;
    }
}

function toDateTimeInputValue(value: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.slice(0, 16);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 16);
}

function InlineSelect({
    value,
    options,
    pending,
    placeholder,
    onChange,
}: {
    value: string;
    options: Array<{ value: string; label: string }>;
    pending?: boolean;
    placeholder?: string;
    onChange?: (value: string) => void;
}) {
    return (
        <select
            value={value}
            disabled={pending}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onChange?.(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/30 disabled:opacity-60"
        >
            {placeholder ? <option value="">{placeholder}</option> : null}
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

function InlineTextEditor({
    value,
    type = "text",
    placeholder,
    pending,
    onCommit,
}: {
    value: string;
    type?: "text" | "datetime-local";
    placeholder?: string;
    pending?: boolean;
    onCommit?: (value: string) => void;
}) {
    const [draft, setDraft] = useState(value);

    useEffect(() => {
        setDraft(value);
    }, [value]);

    return (
        <input
            type={type}
            value={draft}
            placeholder={placeholder}
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                if (draft !== value) onCommit?.(draft);
            }}
            onKeyDown={(event) => {
                if (event.key === "Enter" && draft !== value) {
                    onCommit?.(draft);
                }
            }}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/30 disabled:opacity-60"
        />
    );
}

function InlineValueInput({
    value,
    pending,
    definition,
    placeholder,
    onChange,
    onCommit,
}: {
    value: string;
    pending?: boolean;
    definition: Pick<CrmWorkspaceColumn, "valueType" | "options" | "id" | "label">;
    placeholder?: string;
    onChange?: (value: string) => void;
    onCommit?: (value: string) => void;
}) {
    if (definition.valueType === "select") {
        return (
            <InlineSelect
                value={value}
                options={definition.options ?? []}
                placeholder={placeholder}
                pending={pending}
                onChange={onChange}
            />
        );
    }

    return (
        <InlineTextEditor
            value={definition.valueType === "datetime" ? toDateTimeInputValue(value || null) : value}
            type={definition.valueType === "datetime" ? "datetime-local" : "text"}
            placeholder={placeholder}
            pending={pending}
            onCommit={(nextValue) => onCommit?.(definition.valueType === "datetime" && nextValue ? new Date(nextValue).toISOString() : nextValue)}
        />
    );
}

function TimelineBlock({
    title,
    items,
    emptyState,
}: {
    title: string;
    items: Array<{ id: string; title: string; detail: string; eyebrow: string; at: string; tone: "neutral" | "positive" | "warning" | "critical" }>;
    emptyState: string;
}) {
    return (
        <section className="rounded-[26px] border border-white/8 bg-black/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
            <div className="mt-4 space-y-3">
                {items.length > 0 ? items.map((item) => (
                    <article key={item.id} className={`rounded-2xl border p-4 ${toneClasses(item.tone)}`}>
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{item.eyebrow}</p>
                            <span className="text-[11px] uppercase tracking-[0.16em] opacity-70">{formatAt(item.at)}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 opacity-85">{item.detail}</p>
                    </article>
                )) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-slate-400">
                        {emptyState}
                    </div>
                )}
            </div>
        </section>
    );
}

function renderRecordValue(record: CrmWorkspaceRecord, columnId: string) {
    switch (columnId) {
        case "company":
            return record.company;
        case "status":
            return record.status;
        case "stage":
            return record.dealStageLabel;
        case "lifecycle":
            return formatLifecycleLabel(record.contactLifecycle);
        case "owner":
            return record.ownerLabel;
        case "priority":
            return record.priority;
        case "nextAction":
            return record.nextAction || "-";
        case "nextActionAt":
            return record.nextActionAtLabel;
        case "cadence":
            return record.cadenceLabel;
        case "recommendation":
            return record.recommendedActionLabel;
        case "proposal":
            return record.proposalLabel;
        case "lastTouch":
            return record.lastTouchLabel;
        case "nextMeeting":
            return record.nextMeetingLabel;
        default:
            return record.extensionValues[columnId] || "-";
    }
}

function resolveRecordEditorValue(record: CrmWorkspaceRecord, column: CrmWorkspaceColumn) {
    switch (column.id) {
        case "status":
            return record.status;
        case "stage":
            return record.dealStageId ?? "";
        case "lifecycle":
            return record.contactLifecycle;
        case "owner":
            return record.ownerUserId ?? "";
        case "priority":
            return record.priority;
        case "nextAction":
            return record.nextAction;
        case "nextActionAt":
            return record.nextActionAt ?? "";
        default: {
            const value = renderRecordValue(record, column.id);
            return value === "-" ? "" : value;
        }
    }
}

function resolveDetailEditorSectionLabel(section: CrmDetailEditorDefinition["section"]) {
    if (section === "workflow") return "Workflow operacional";
    if (section === "qualification") return "Qualificacao controlada";
    return "Campos do nicho";
}

function resolveDetailEditorValue(detail: CrmRecordDetailModel, editor: CrmDetailEditorDefinition) {
    return detail.editableValues[editor.columnId] ?? "";
}

function renderTableCell(
    record: CrmWorkspaceRecord,
    column: CrmWorkspaceColumn,
    pendingMutationKey: string | null,
    onInlineChange?: (assessmentId: string, payload: { field: CrmEditableField; value: string }) => void,
) {
    if (!column.editableField) return renderRecordValue(record, column.id);

    const mutationKey = `${record.id}:${column.editableField}`;
    const value = resolveRecordEditorValue(record, column);

    return (
        <InlineValueInput
            value={value}
            definition={column}
            placeholder={column.id === "stage" ? "Promover para deal" : `Editar ${column.label.toLowerCase()}`}
            pending={pendingMutationKey === mutationKey}
            onChange={(nextValue) => {
                if (column.valueType === "select") {
                    if (column.id === "stage" && !nextValue) return;
                    onInlineChange?.(record.id, { field: column.editableField!, value: nextValue });
                }
            }}
            onCommit={(nextValue) => onInlineChange?.(record.id, { field: column.editableField!, value: nextValue })}
        />
    );
}

export function CrmWorkspaceView({
    slug,
    data,
    filteredRecords,
    visibleColumns,
    allowedColumns,
    visibleColumnIds,
    selectedView,
    search,
    viewMode,
    selectedId,
    selectedIds,
    activeSortId,
    detail,
    detailLoading,
    detailError,
    workspaceNotice,
    pendingMutationKey,
    bulkDefinition,
    bulkValue,
    bulkPending,
    playbookPending,
    saveViewName,
    saveViewScope,
    saveViewPending,
    workflowShortcuts,
    viewPlaybooks,
    detailRecommendations,
    onSearchChange,
    onViewChange,
    onViewModeChange,
    onViewSortChange,
    onSelectRecord,
    onToggleRecordSelection,
    onSelectVisible,
    onClearSelection,
    onToggleColumn,
    onInlineChange,
    onBulkFieldChange,
    onBulkValueChange,
    onBulkApply,
    onWorkflowShortcut,
    onRunPlaybook,
    onRunRecommendation,
    onSaveViewNameChange,
    onSaveViewScopeChange,
    onSaveView,
}: {
    slug: string;
    data: OperatorCrmWorkspaceModel;
    filteredRecords: CrmWorkspaceRecord[];
    visibleColumns: CrmWorkspaceColumn[];
    allowedColumns: CrmWorkspaceColumn[];
    visibleColumnIds: string[];
    selectedView?: OperatorCrmWorkspaceModel["views"]["presets"][number];
    search: string;
    viewMode: "table" | "board";
    selectedId: string | null;
    selectedIds: string[];
    activeSortId: CrmViewSortId;
    detail: CrmRecordDetailModel | null;
    detailLoading: boolean;
    detailError: string | null;
    workspaceNotice: { tone: "positive" | "warning" | "critical"; message: string } | null;
    pendingMutationKey: string | null;
    bulkDefinition?: CrmBulkActionDefinition;
    bulkValue: string;
    bulkPending: boolean;
    playbookPending: boolean;
    saveViewName: string;
    saveViewScope: CrmViewScope;
    saveViewPending: boolean;
    workflowShortcuts: CrmWorkflowShortcut[];
    viewPlaybooks: CrmPlaybookDefinition[];
    detailRecommendations: CrmRecommendedAction[];
    onSearchChange?: (value: string) => void;
    onViewChange?: (value: string) => void;
    onViewModeChange?: (value: "table" | "board") => void;
    onViewSortChange?: (value: CrmViewSortId) => void;
    onSelectRecord?: (assessmentId: string) => void;
    onToggleRecordSelection?: (assessmentId: string) => void;
    onSelectVisible?: () => void;
    onClearSelection?: () => void;
    onToggleColumn?: (columnId: string) => void;
    onInlineChange?: (assessmentId: string, payload: { field: CrmEditableField; value: string }) => void;
    onBulkFieldChange?: (field: CrmBulkActionDefinition["field"]) => void;
    onBulkValueChange?: (value: string) => void;
    onBulkApply?: () => void;
    onWorkflowShortcut?: (shortcut: CrmWorkflowShortcut) => void;
    onRunPlaybook?: (playbookId: CrmPlaybookDefinition["id"]) => void;
    onRunRecommendation?: (playbookId: CrmRecommendedAction["playbookId"]) => void;
    onSaveViewNameChange?: (value: string) => void;
    onSaveViewScopeChange?: (value: CrmViewScope) => void;
    onSaveView?: () => void;
}) {
    const activeViewId = selectedView?.baseViewId ?? "all";
    const boardColumns = data.board.columnsByView[activeViewId] ?? data.board.columns;
    const boardCardColumns = visibleColumns.filter((column) => column.id !== "company").slice(0, 3);
    const detailEditorsBySection = data.editable.detailEditors.reduce<Record<string, CrmDetailEditorDefinition[]>>((acc, editor) => {
        if (!acc[editor.section]) acc[editor.section] = [];
        acc[editor.section].push(editor);
        return acc;
    }, {});

    return (
        <div className="space-y-8">
            <section className="rounded-[32px] border border-white/8 bg-[linear-gradient(135deg,rgba(59,130,246,0.12),rgba(7,16,28,0.94))] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.28)]">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-4xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100">
                            <Sparkles className="h-3.5 w-3.5" />
                            CRM Workspace v6
                        </div>
                        <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">{data.summary.headline}</h1>
                        <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 md:text-base">{data.summary.subheadline}</p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <Link href={`/org/${slug}/admin/whatsapp`} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]">Abrir WhatsApp CRM</Link>
                            <Link href={`/org/${slug}/admin/deals`} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]">Abrir deal flow</Link>
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:w-[520px]">
                        {data.summary.metrics.map((metric) => (
                            <article key={metric.id} className={`rounded-[24px] border p-4 ${toneClasses(metric.tone)}`}>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                                <p className="mt-3 text-2xl font-semibold tracking-tight">{metric.value}</p>
                                <p className="mt-2 text-sm leading-6 opacity-85">{metric.detail}</p>
                            </article>
                        ))}
                    </div>
                </div>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {data.summary.focus.map((item, index) => (
                        <div key={`${item}-${index}`} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-slate-100">{item}</div>
                    ))}
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_420px]">
                <div className="space-y-6">
                    <section className="rounded-[30px] border border-white/8 bg-[#07101c] p-6">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
                                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{selectedView?.label ?? "Views configuraveis"}</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-300">{selectedView?.description ?? data.niche.description}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => onViewModeChange?.("table")} className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${viewMode === "table" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"}`}><LayoutList className="h-4 w-4" />Table</button>
                                <button type="button" onClick={() => onViewModeChange?.("board")} className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${viewMode === "board" ? "border-sky-400/20 bg-sky-400/10 text-sky-100" : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"}`}><KanbanSquare className="h-4 w-4" />Board</button>
                            </div>
                        </div>

                        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                            <label className="relative block">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <input value={search} onChange={(event) => onSearchChange?.(event.target.value)} placeholder="Buscar conta, contato, proposta ou campo do nicho" className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-emerald-400/30" />
                            </label>
                            <InlineSelect value={activeSortId} options={data.views.sortOptions.map((option) => ({ value: option.id, label: option.label }))} onChange={(value) => onViewSortChange?.(value as CrmViewSortId)} />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {data.views.presets.map((preset) => (
                                <button key={preset.id} type="button" onClick={() => onViewChange?.(preset.id)} className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${selectedView?.id === preset.id ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"}`}>
                                    {preset.label}
                                    {preset.kind === "saved" ? ` · ${preset.scope === "tenant" ? "tenant" : "minha"}` : ""}
                                </button>
                            ))}
                        </div>

                        <div className="mt-6 grid gap-4 rounded-[26px] border border-white/8 bg-black/10 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={onSelectVisible} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-100 transition hover:bg-white/[0.08]">Selecionar visiveis</button>
                                <button type="button" onClick={onClearSelection} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-100 transition hover:bg-white/[0.08]">Limpar selecao</button>
                                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">{selectedIds.length} selecionados</span>
                            </div>

                            {workflowShortcuts.length > 0 ? (
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workflow shortcuts</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {workflowShortcuts.map((shortcut) => (
                                            <button key={shortcut.id} type="button" onClick={() => onWorkflowShortcut?.(shortcut)} className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm text-sky-100 transition hover:bg-sky-400/20">
                                                {shortcut.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {viewPlaybooks.length > 0 ? (
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Playbooks operacionais</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {viewPlaybooks.map((playbook) => (
                                            <button key={playbook.id} type="button" onClick={() => onRunPlaybook?.(playbook.id)} disabled={playbookPending} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60">
                                                {playbook.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_140px]">
                                <InlineSelect value={bulkDefinition?.field ?? ""} options={data.editable.bulkActions.map((action) => ({ value: action.field, label: action.label }))} pending={bulkPending} onChange={(value) => onBulkFieldChange?.(value as CrmBulkActionDefinition["field"])} />
                                {bulkDefinition ? (
                                    <InlineValueInput
                                        value={bulkValue}
                                        pending={bulkPending}
                                        definition={{
                                            id: bulkDefinition.id,
                                            label: bulkDefinition.label,
                                            valueType: bulkDefinition.valueType,
                                            options: bulkDefinition.options,
                                        }}
                                        placeholder={bulkDefinition.placeholder ?? bulkDefinition.description}
                                        onChange={onBulkValueChange}
                                        onCommit={onBulkValueChange}
                                    />
                                ) : null}
                                <button type="button" onClick={onBulkApply} disabled={bulkPending || selectedIds.length === 0} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60">Aplicar lote</button>
                            </div>

                            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_140px]">
                                <input value={saveViewName} onChange={(event) => onSaveViewNameChange?.(event.target.value)} placeholder="Nome da view salva" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/30" />
                                <InlineSelect value={saveViewScope} options={data.views.saveScopes} pending={saveViewPending} onChange={(value) => onSaveViewScopeChange?.(value as CrmViewScope)} />
                                <button type="button" onClick={onSaveView} disabled={saveViewPending} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60">Salvar view</button>
                            </div>

                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Colunas visiveis</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {allowedColumns.map((column) => {
                                        const active = visibleColumnIds.includes(column.id);
                                        return (
                                            <button key={column.id} type="button" onClick={() => onToggleColumn?.(column.id)} disabled={column.id === "company"} className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${active ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"} ${column.id === "company" ? "cursor-not-allowed opacity-70" : ""}`}>
                                                {column.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {workspaceNotice ? <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${toneClasses(workspaceNotice.tone === "critical" ? "critical" : workspaceNotice.tone === "warning" ? "warning" : "positive")}`}>{workspaceNotice.message}</div> : null}

                        {viewMode === "table" ? (
                            <div className="mt-6 overflow-x-auto">
                                <table className="min-w-full border-separate border-spacing-y-3">
                                    <thead>
                                        <tr>
                                            <th className="px-3 pb-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sel.</th>
                                            {visibleColumns.map((column) => <th key={column.id} className="px-3 pb-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{column.label}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecords.length > 0 ? filteredRecords.map((record) => (
                                            <tr key={record.id} onClick={() => onSelectRecord?.(record.id)} className={`cursor-pointer rounded-2xl border transition ${selectedId === record.id ? "bg-white/[0.08]" : "bg-black/10 hover:bg-white/[0.04]"}`}>
                                                <td className="rounded-l-2xl border border-white/8 px-3 py-4 align-top text-sm text-slate-300">
                                                    <input type="checkbox" checked={selectedIds.includes(record.id)} onClick={(event) => event.stopPropagation()} onChange={() => onToggleRecordSelection?.(record.id)} className="h-4 w-4 rounded border-white/20 bg-transparent text-emerald-400" />
                                                </td>
                                                {visibleColumns.map((column, index) => (
                                                    <td key={`${record.id}-${column.id}`} className={`border border-white/8 px-3 py-4 align-top text-sm text-slate-300 ${index === visibleColumns.length - 1 ? "rounded-r-2xl border-l-0" : "border-l-0 border-r-0"}`}>
                                                        {column.id === "company" ? (
                                                            <div>
                                                                <p className="text-sm font-semibold text-white">{record.company}</p>
                                                                <p className="mt-1 text-sm text-slate-300">{record.primaryContact}</p>
                                                                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">{record.scoreLabel}</p>
                                                            </div>
                                                        ) : (
                                                            renderTableCell(record, column, pendingMutationKey, onInlineChange)
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={visibleColumns.length + 1} className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-12 text-center text-sm text-slate-400">Nenhum registro corresponde a view atual.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="mt-6 overflow-x-auto">
                                <div className="flex min-w-max gap-4">
                                    {boardColumns.map((column) => {
                                        const columnRecords = filteredRecords.filter((record) => (record.boardColumnByView[activeViewId] ?? record.boardColumnId) === column.id);
                                        return (
                                            <section key={column.id} className="w-[310px] shrink-0 rounded-[26px] border border-white/8 bg-black/10 p-4">
                                                <div className={`rounded-2xl border px-4 py-3 ${toneClasses(column.tone)}`}>
                                                    <p className="text-sm font-semibold">{column.label}</p>
                                                    <p className="mt-1 text-xs leading-5 opacity-85">{column.description}</p>
                                                </div>
                                                <div className="mt-4 space-y-3">
                                                    {columnRecords.length > 0 ? columnRecords.map((record) => (
                                                        <button key={record.id} type="button" onClick={() => onSelectRecord?.(record.id)} className={`block w-full rounded-2xl border p-4 text-left transition ${selectedId === record.id ? "border-emerald-400/20 bg-emerald-400/10" : "border-white/8 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="text-sm font-semibold text-white">{record.company}</p>
                                                                    <p className="mt-1 text-sm text-slate-300">{record.primaryContact}</p>
                                                                </div>
                                                                <input type="checkbox" checked={selectedIds.includes(record.id)} onClick={(event) => event.stopPropagation()} onChange={() => onToggleRecordSelection?.(record.id)} className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-emerald-400" />
                                                            </div>
                                                            <div className="mt-3 grid gap-1 text-xs text-slate-400">
                                                                {boardCardColumns.map((cardColumn) => (
                                                                    <p key={`${record.id}-${cardColumn.id}`}>
                                                                        {cardColumn.label}: {renderRecordValue(record, cardColumn.id)}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        </button>
                                                    )) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400">Sem cards nesse stage.</div>}
                                                </div>
                                            </section>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </section>
                    {data.warnings.length > 0 ? <section className="rounded-[30px] border border-white/8 bg-[#07101c] p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Leitura honesta</p><div className="mt-4 grid gap-3">{data.warnings.map((warning, index) => <div key={`${warning}-${index}`} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm leading-6 text-slate-300">{warning}</div>)}</div></section> : null}
                </div>

                <aside className="rounded-[30px] border border-white/8 bg-[#07101c] p-6">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-100"><MessageSquareText className="h-5 w-5" /></div>
                        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Lead / Contact / Deal</p><h2 className="text-2xl font-semibold tracking-tight text-white">Record 360</h2></div>
                    </div>
                    {detailLoading ? <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-10 text-sm text-slate-400">Carregando detalhe do registro...</div> : null}
                    {detailError ? <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">{detailError}</div> : null}
                    {!detailLoading && !detailError && detail ? (
                        <div className="mt-6 space-y-6">
                            <section className="rounded-[26px] border border-white/8 bg-black/10 p-5">
                                <h3 className="text-2xl font-semibold tracking-tight text-white">{detail.company}</h3>
                                <p className="mt-2 text-sm text-slate-300">{detail.primaryContact}</p>
                                <p className="mt-1 text-sm text-slate-400">{detail.subtitle}</p>
                                <div className="mt-4 flex flex-wrap gap-2">{detail.badges.map((badge) => <span key={badge.id} className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClasses(badge.tone)}`}>{badge.label}</span>)}</div>
                                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                                    <div className={`rounded-2xl border p-4 ${toneClasses(detail.conversation?.tone ?? "neutral")}`}>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">Contexto conversacional</p>
                                        {detail.conversation ? (
                                            <>
                                                <p className="mt-3 text-sm font-semibold">{detail.conversation.label}</p>
                                                <p className="mt-2 text-sm leading-6 opacity-85">{detail.conversation.detail}</p>
                                                <div className="mt-4 grid gap-2 text-xs opacity-85">
                                                    <p>Status: {detail.conversation.statusLabel}</p>
                                                    <p>Fila: {detail.conversation.unreadLabel}</p>
                                                    <p>Ultima mensagem: {detail.conversation.lastMessageAtLabel}</p>
                                                    <p>Preview: {detail.conversation.lastMessagePreview}</p>
                                                    <p>SLA: {detail.conversation.slaLabel}</p>
                                                    <p>Responsavel: {detail.conversation.assignmentLabel}</p>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="mt-3 text-sm leading-6 opacity-85">Sem conversa vinculada a este record ainda. O detalhe continua operando sobre o backbone canonico sem abrir inbox paralelo.</p>
                                        )}
                                    </div>
                                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Centro vivo de execucao</p>
                                        <div className="mt-4 grid gap-3">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Ultima interacao</p>
                                                <p className="mt-1 text-sm text-white">{detail.operationalSummary.lastInteractionLabel}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pendente agora</p>
                                                <p className="mt-1 text-sm leading-6 text-slate-300">{detail.operationalSummary.pendingLabel}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Proxima melhor acao</p>
                                                <p className="mt-1 text-sm leading-6 text-white">{detail.operationalSummary.nextBestActionLabel}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {detail.quickActions.length > 0 ? (
                                    <div className="mt-5 border-t border-white/8 pt-5">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Acoes rapidas</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {detail.quickActions.map((action) => {
                                                const className = `rounded-2xl border px-4 py-2 text-sm font-medium transition ${toneClasses(action.tone)} hover:opacity-90`;
                                                if (action.kind === "link" && action.href) {
                                                    return <Link key={action.id} href={action.href} className={className}>{action.label}</Link>;
                                                }

                                                if (action.kind === "playbook" && action.playbookId) {
                                                    const playbookId = action.playbookId;
                                                    return (
                                                        <button key={action.id} type="button" onClick={() => onRunRecommendation?.(playbookId)} disabled={playbookPending} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
                                                            {action.label}
                                                        </button>
                                                    );
                                                }

                                                if (action.kind === "inline-update" && action.field && typeof action.value === "string") {
                                                    return (
                                                        <button key={action.id} type="button" onClick={() => onInlineChange?.(detail.id, { field: action.field!, value: action.value! })} disabled={pendingMutationKey === `${detail.id}:${action.field}`} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
                                                            {action.label}
                                                        </button>
                                                    );
                                                }

                                                return null;
                                            })}
                                        </div>
                                    </div>
                                ) : null}
                                {(["workflow", "qualification", "niche"] as CrmDetailEditorDefinition["section"][]).map((section) => {
                                    const editors = detailEditorsBySection[section] ?? [];
                                    if (editors.length === 0) return null;

                                    return (
                                        <div key={section} className="mt-5 border-t border-white/8 pt-5">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{resolveDetailEditorSectionLabel(section)}</p>
                                            <div className="mt-3 grid gap-3">
                                                {editors.map((editor) => (
                                                    <div key={editor.id}>
                                                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{editor.label}</p>
                                                        <InlineValueInput
                                                            value={resolveDetailEditorValue(detail, editor)}
                                                            definition={{
                                                                id: editor.id,
                                                                label: editor.label,
                                                                valueType: editor.valueType,
                                                                options: editor.options,
                                                            }}
                                                            placeholder={editor.columnId === "stage" ? "Promover para deal" : `Editar ${editor.label.toLowerCase()}`}
                                                            pending={pendingMutationKey === `${detail.id}:${editor.field}`}
                                                            onChange={(value) => {
                                                                if (editor.valueType === "select") {
                                                                    if (editor.columnId === "stage" && !value) return;
                                                                    onInlineChange?.(detail.id, { field: editor.field, value });
                                                                }
                                                            }}
                                                            onCommit={(value) => onInlineChange?.(detail.id, { field: editor.field, value })}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="mt-5 flex flex-wrap gap-2">{detail.quickLinks.map((link) => <Link key={link.id} href={link.href} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]">{link.label}</Link>)}</div>
                                {detailRecommendations.length > 0 ? (
                                    <div className="mt-5 border-t border-white/8 pt-5">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Acoes recomendadas</p>
                                        <div className="mt-3 grid gap-3">
                                            {detailRecommendations.map((recommendation) => (
                                                <div key={recommendation.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                                    <p className="text-sm font-semibold text-white">{recommendation.title}</p>
                                                    <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.reason}</p>
                                                    <button type="button" onClick={() => onRunRecommendation?.(recommendation.playbookId)} disabled={playbookPending} className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60">
                                                        {recommendation.actionLabel}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </section>
                            <section className="rounded-[26px] border border-white/8 bg-black/10 p-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{detail.overview.title}</p>
                                <div className="mt-4 grid gap-3">{detail.overview.items.map((item) => <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p><p className="mt-1 text-sm text-slate-100">{item.value}</p></div>)}</div>
                            </section>
                            <section className="rounded-[26px] border border-white/8 bg-black/10 p-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Timeline operacional</p>
                                <div className="mt-4 space-y-3">
                                    {detail.timeline.length > 0 ? detail.timeline.map((item) => (
                                        <article key={item.id} className={`rounded-2xl border p-4 ${toneClasses(item.tone)}`}>
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{item.kind}</p>
                                                <span className="text-[11px] uppercase tracking-[0.16em] opacity-70">{formatAt(item.at)}</span>
                                            </div>
                                            <p className="mt-2 text-sm font-semibold">{item.title}</p>
                                            <p className="mt-1 text-sm leading-6 opacity-85">{item.detail}</p>
                                        </article>
                                    )) : (
                                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-slate-400">
                                            Nenhuma interacao recente consolidada para este registro.
                                        </div>
                                    )}
                                </div>
                            </section>
                            {detail.nicheSections.map((section) => (
                                <section key={section.id} className="rounded-[26px] border border-white/8 bg-black/10 p-5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{section.title}</p>
                                    <p className="mt-2 text-sm text-slate-300">{section.description}</p>
                                    <div className="mt-4 grid gap-3">{section.items.length > 0 ? section.items.map((item) => <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p><p className="mt-1 text-sm text-slate-100">{item.value}</p></div>) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-slate-400">Nenhum campo adicional estruturado para este nicho ainda.</div>}</div>
                                </section>
                            ))}
                            <TimelineBlock title="Propostas vinculadas" items={detail.proposals} emptyState="Ainda nao ha proposta vinculada ao deal canonico." />
                            <TimelineBlock title="Activity trail" items={detail.activities} emptyState="A trilha operacional ainda nao registrou atividade relevante." />
                            <TimelineBlock title="Agenda e follow-up" items={detail.agenda} emptyState="Nao ha agenda conectada a este registro no momento." />
                            <section className="rounded-[26px] border border-white/8 bg-black/10 p-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Mensagens recentes</p>
                                <div className="mt-4 space-y-3">
                                    {detail.messages.length > 0 ? detail.messages.map((message) => (
                                        <article key={message.id} className={`rounded-2xl border px-4 py-3 ${message.direction === "outbound" ? "border-sky-400/20 bg-sky-400/10" : "border-white/8 bg-white/[0.03]"}`}>
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{message.direction === "outbound" ? "Outbound" : "Inbound"}</p>
                                                <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{formatAt(message.at)}</span>
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-slate-100">{message.text}</p>
                                            <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">{message.status}</p>
                                        </article>
                                    )) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-slate-400">Selecione um registro na table ou no board.</div>}
                                </div>
                            </section>
                        </div>
                    ) : null}
                    {!detailLoading && !detailError && !detail ? <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-10 text-sm text-slate-400">Selecione um registro na table ou no board.</div> : null}
                </aside>
            </section>
        </div>
    );
}
