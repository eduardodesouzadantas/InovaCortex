"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, ChevronDown, TrendingUp } from "lucide-react";

interface Performance {
    id: string;
    outcome: string;
    closedValue: number;
    notes: string;
}

interface Meeting {
    id: string;
    leadEmail: string;
    startAt: string;
    endAt: string;
    status: string;
    priorityTier: string;
    closeProbability: number;
    revenueScore: number;
    meetingUrl?: string;
    performance?: Performance | null;
}

const TIER_COLORS: Record<string, string> = {
    hot: "text-red-400 bg-red-400/10 border-red-400/20",
    warm: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    cold: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

const OUTCOME_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    won: { label: "Ganho", color: "text-green-400", icon: CheckCircle2 },
    lost: { label: "Perdido", color: "text-red-400", icon: XCircle },
    no_show: { label: "No-show", color: "text-orange-400", icon: AlertTriangle },
    pending: { label: "Pendente", color: "text-slate-400", icon: Clock },
};

function OutcomeModal({ meeting, onClose, onSave }: { meeting: Meeting; onClose: () => void; onSave: (data: any) => void; }) {
    const [outcome, setOutcome] = useState(meeting.performance?.outcome ?? "pending");
    const [closedValue, setClosedValue] = useState(meeting.performance?.closedValue ?? 0);
    const [notes, setNotes] = useState(meeting.performance?.notes ?? "");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        setSaving(true);
        await onSave({ outcome, closedValue: Number(closedValue), notes });
        setSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="font-black text-lg mb-1">Registrar Outcome</h2>
                <p className="text-xs text-muted-foreground mb-6">{meeting.leadEmail}</p>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-2 block">Resultado</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(OUTCOME_CONFIG).map(([key, cfg]) => (
                                <button
                                    key={key}
                                    onClick={() => setOutcome(key)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${outcome === key ? "border-white/40 bg-white/10" : "border-white/10 bg-white/3 hover:bg-white/5"
                                        } ${cfg.color}`}
                                >
                                    <cfg.icon className="w-4 h-4" />
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-2 block">Valor Fechado (R$)</label>
                        <input
                            type="number"
                            value={closedValue}
                            onChange={e => setClosedValue(Number(e.target.value))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-white/30"
                            placeholder="0.00"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-2 block">Notas</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-white/30 resize-none"
                            placeholder="Contexto, próximos passos..."
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MeetingRow({ meeting, orgSlug, onUpdated }: { meeting: Meeting; orgSlug: string; onUpdated: (id: string, perf: any) => void }) {
    const [showModal, setShowModal] = useState(false);

    const perf = meeting.performance;
    const outcome = perf?.outcome ?? "pending";
    const cfg = OUTCOME_CONFIG[outcome] ?? OUTCOME_CONFIG.pending;
    const Icon = cfg.icon;

    const handleSave = async (data: any) => {
        const res = await fetch(`/api/admin/meetings/${meeting.id}/outcome`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            const json = await res.json();
            onUpdated(meeting.id, json.performance);
        }
    };

    const startDate = new Date(meeting.startAt);

    return (
        <>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center p-4 rounded-xl border border-white/5 bg-white/2 hover:bg-white/4 transition-colors">
                {/* Lead */}
                <div>
                    <p className="text-sm font-semibold truncate">{meeting.leadEmail}</p>
                    <p className="text-xs text-muted-foreground">
                        {startDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} · {startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                </div>

                {/* Tier */}
                <div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${TIER_COLORS[meeting.priorityTier] ?? TIER_COLORS.cold}`}>
                        {meeting.priorityTier?.toUpperCase()}
                    </span>
                </div>

                {/* Status */}
                <div>
                    <span className={`text-xs font-semibold ${meeting.status === "completed" ? "text-green-400" : meeting.status === "canceled" ? "text-red-400" : "text-yellow-400"}`}>
                        {meeting.status}
                    </span>
                </div>

                {/* Outcome */}
                <div className={`flex items-center gap-1 text-xs font-bold ${cfg.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                    {perf?.closedValue ? ` · R$${perf.closedValue.toLocaleString("pt-BR")}` : ""}
                </div>

                {/* Actions */}
                <button
                    onClick={() => setShowModal(true)}
                    className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 font-semibold transition-colors whitespace-nowrap"
                >
                    Registrar
                </button>
            </div>

            {showModal && (
                <OutcomeModal meeting={meeting} onClose={() => setShowModal(false)} onSave={handleSave} />
            )}
        </>
    );
}

export function MeetingsClient({ orgSlug, meetings: initialMeetings }: { orgSlug: string; meetings: Meeting[] }) {
    const [meetings, setMeetings] = useState(initialMeetings);
    const [runningJob, setRunningJob] = useState(false);
    const [jobResult, setJobResult] = useState<any>(null);

    const handleUpdated = (id: string, perf: any) => {
        setMeetings(prev => prev.map(m => m.id === id ? { ...m, performance: perf } : m));
    };

    const runCompleteJob = async () => {
        setRunningJob(true);
        try {
            const res = await fetch("/api/admin/orchestrator/complete-meetings", { method: "POST" });
            const data = await res.json();
            setJobResult(data);
        } finally {
            setRunningJob(false);
        }
    };

    if (meetings.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground">
                <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma reunião nos últimos 30 dias</p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-2">
            {/* Header actions */}
            <div className="flex items-center justify-between mb-4">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 flex-1 px-4 text-xs font-semibold text-muted-foreground">
                    <span>Lead</span>
                    <span>Tier</span>
                    <span>Status</span>
                    <span>Outcome</span>
                    <span></span>
                </div>
                <button
                    onClick={runCompleteJob}
                    disabled={runningJob}
                    className="ml-4 flex items-center gap-2 text-xs bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg px-3 py-1.5 font-semibold hover:bg-indigo-600/30 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                    {runningJob ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Concluir Stale
                </button>
            </div>

            {jobResult && (
                <div className="text-xs bg-green-500/10 border border-green-500/20 text-green-300 rounded-lg px-4 py-2 mb-3">
                    ✓ {jobResult.completed} completadas · {jobResult.followupsQueued} follow-ups enfileirados
                </div>
            )}

            <div className="space-y-2">
                {meetings.map(m => (
                    <MeetingRow key={m.id} meeting={m} orgSlug={orgSlug} onUpdated={handleUpdated} />
                ))}
            </div>
        </div>
    );
}
