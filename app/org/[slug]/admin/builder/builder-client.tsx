"use client";
/**
 * app/org/[slug]/admin/builder/builder-client.tsx
 * V25.4: Builder Cockpit — the full internal autopilot UI.
 *
 * Sections:
 *  1) Create BuildRun (mode + input snapshot)
 *  2) Blueprint preview (collapsible JSON viewer)
 *  3) Prompt Pack timeline (Part 1..N + copy-to-clipboard)
 *  4) Review Gate (Approve / Reject with confirm)
 *  5) Run log / audit trail
 *
 * Tabs:
 *   - Build Runs    (active runs + create)
 *   - Templates     (library + new version + edit)
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const G = "#d4af37";   // gold
const G2 = "#f5cc5a";   // gold light
const IND = "#6366f1";   // indigo
const RED = "#f87171";
const GRN = "#4ade80";
const PUR = "#a78bfa";
const BG = "#0b0b0f";
const CARD = "rgba(255,255,255,0.03)";
const BORD = "rgba(255,255,255,0.07)";

const STATUS_META: Record<string, { color: string; label: string; emoji: string }> = {
    draft: { color: "rgba(255,255,255,0.3)", label: "Draft", emoji: "✏️" },
    review: { color: G2, label: "Em Revisão", emoji: "👁" },
    approved: { color: PUR, label: "Aprovado", emoji: "✅" },
    executing: { color: IND, label: "Executando", emoji: "⚡" },
    done: { color: GRN, label: "Concluído", emoji: "🎯" },
    failed: { color: RED, label: "Falhou", emoji: "❌" },
};

const MODE_META: Record<string, { label: string; desc: string }> = {
    plan_only: { label: "📋 Plan Only", desc: "Gera plano de implementação sem código" },
    prompt_pack: { label: "💬 Prompt Pack", desc: "Gera sequência de prompts para Antigravity" },
    code_patch: { label: "⚙️ Code Patch", desc: "Gera diff/patch de código direto" },
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface BuildArtifact {
    id: string;
    type: string;
    version: number;
    body: string;
    createdAt: string;
}

interface BuildRun {
    id: string;
    mode: string;
    status: string;
    targetOrgSlug: string | null;
    inputJson: string;
    outputJson: string | null;
    createdAt: string;
    updatedAt: string;
    artifacts: BuildArtifact[];
}

interface BuildTemplate {
    id: string;
    key: string;
    name: string;
    description: string;
    version: number;
}

interface PreflightCheck {
    id: string;
    description: string;
    blocking: boolean;
}

interface Props { orgSlug: string }

// ─── Helpers ───────────────────────────────────────────────────────────────────
function Glass({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
    return (
        <div className={`rounded-2xl ${className}`} style={{ background: CARD, border: `1px solid ${BORD}`, ...style }}>
            {children}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const m = STATUS_META[status] ?? { color: "rgba(255,255,255,0.3)", label: status, emoji: "•" };
    return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}33` }}>
            {m.emoji} {m.label}
        </span>
    );
}

function CopyBtn({ text, label = "Copiar" }: { text: string; label?: string }) {
    const [done, setDone] = useState(false);
    function copy() {
        navigator.clipboard.writeText(text).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1800);
        });
    }
    return (
        <button onClick={copy}
            className="text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 flex-shrink-0 transition-all"
            style={{
                background: done ? `${GRN}18` : "rgba(255,255,255,0.05)",
                color: done ? GRN : "rgba(255,255,255,0.35)",
                border: `1px solid ${done ? GRN + "33" : "transparent"}`,
            }}>
            {done ? "✓ Copiado!" : label}
        </button>
    );
}

function Input({ value, onChange, placeholder, mono = false, ...rest }: any) {
    return (
        <input value={value} onChange={onChange} placeholder={placeholder}
            className={`w-full text-xs px-3 py-2 rounded-xl border outline-none bg-transparent ${mono ? "font-mono" : ""}`}
            style={{ borderColor: BORD, color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.02)" }}
            {...rest} />
    );
}

function Textarea({ value, onChange, placeholder, rows = 5, mono = true }: any) {
    return (
        <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
            className={`w-full text-xs px-3 py-2 rounded-xl border outline-none resize-y ${mono ? "font-mono" : ""}`}
            style={{ borderColor: BORD, color: "rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.02)" }} />
    );
}

function SectionLabel({ text }: { text: string }) {
    return (
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3" style={{ color: G }}>
            {text}
        </p>
    );
}

// ─── 1) Create Run Form ────────────────────────────────────────────────────────
function CreateRunForm({ orgSlug, onCreated }: { orgSlug: string; onCreated: () => void }) {
    const [mode, setMode] = useState("prompt_pack");
    const [target, setTarget] = useState("");
    const [input, setInput] = useState(
        JSON.stringify({
            company: "Example Corp", segment: "SaaS", industry: "saas",
            channels: ["WhatsApp", "LinkedIn"], stack: ["CRM", "API"],
            pains: ["Retrabalho", "Conversão baixa"], urgency: "alta",
            goal: "Vender mais e reduzir custo operacional", scoreTotal: 78,
            modules: ["whatsapp_agent", "ai_brain", "dashboard_cockpit"]
        }, null, 2)
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit() {
        setLoading(true); setError(null);
        try {
            const res = await fetch(`/api/org/${orgSlug}/builder/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-builder-role": "admin" },
                body: JSON.stringify({ mode, inputJson: input, targetOrgSlug: target || undefined }),
            });
            if (!res.ok) { setError((await res.json()).error); return; }
            onCreated();
        } catch (e: any) { setError(e?.message); }
        finally { setLoading(false); }
    }

    return (
        <Glass className="p-6 space-y-4" style={{ border: `1px solid ${G}22` }}>
            <SectionLabel text="Novo Build Run" />

            {/* Mode picker */}
            <div className="grid grid-cols-3 gap-2">
                {Object.entries(MODE_META).map(([k, m]) => (
                    <button key={k} onClick={() => setMode(k)}
                        className="rounded-xl p-3 text-left transition-all"
                        style={{
                            background: mode === k ? `${IND}18` : "rgba(255,255,255,0.02)",
                            border: `1px solid ${mode === k ? `${IND}44` : BORD}`,
                        }}>
                        <p className="text-xs font-semibold" style={{ color: mode === k ? PUR : "rgba(255,255,255,0.5)" }}>
                            {m.label}
                        </p>
                        <p className="text-[10px] mt-0.5 leading-tight" style={{ color: "rgba(255,255,255,0.25)" }}>
                            {m.desc}
                        </p>
                    </button>
                ))}
            </div>

            {/* Target org (optional) */}
            <div>
                <p className="text-[10px] mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Target Org Slug (opcional)</p>
                <Input value={target} onChange={(e: any) => setTarget(e.target.value)} placeholder="ex: meu-cliente" />
            </div>

            {/* Input snapshot JSON */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Input Snapshot JSON</p>
                    <CopyBtn text={input} label="Copiar JSON" />
                </div>
                <Textarea value={input} onChange={(e: any) => setInput(e.target.value)} rows={9} />
            </div>

            {error && (
                <p className="text-xs rounded-xl px-3 py-2" style={{ background: "rgba(248,113,113,0.08)", color: RED }}>
                    {error}
                </p>
            )}

            <button onClick={submit} disabled={loading}
                className="w-full py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{
                    background: loading ? "rgba(255,255,255,0.04)" : `linear-gradient(135deg,${IND},${G})`,
                    color: loading ? "rgba(255,255,255,0.25)" : "white",
                }}>
                {loading ? "Criando Run…" : "⚡ Criar Build Run"}
            </button>
        </Glass>
    );
}

// ─── 2) Blueprint JSON Viewer ─────────────────────────────────────────────────
function BlueprintViewer({ json }: { json: string }) {
    const [open, setOpen] = useState(false);
    let parsed: any = null;
    try { parsed = JSON.parse(json); } catch { }

    if (!parsed) return null;

    const pf: PreflightCheck[] = parsed.preflightChecks ?? [];
    const blocking = pf.filter((c: PreflightCheck) => c.blocking);
    const nonBlock = pf.filter((c: PreflightCheck) => !c.blocking);

    return (
        <Glass className="overflow-hidden">
            <button className="w-full px-4 py-3 flex items-center gap-3 text-left"
                onClick={() => setOpen(!open)}>
                <span className="text-sm">🗺️</span>
                <div className="flex-1">
                    <p className="text-xs font-semibold text-white">Blueprint</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {parsed.selectedModules?.length ?? 0} módulos · tier: {parsed.tier} · checksum {parsed._checksum}
                    </p>
                </div>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>{open ? "▲" : "▼"}</span>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                        transition={{ duration: 0.22 }} className="overflow-hidden"
                        style={{ borderTop: `1px solid ${BORD}` }}>
                        <div className="p-4 space-y-4">

                            {/* Pre-flight checklist */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: G }}>
                                    ✅ Pre-flight Checklist
                                </p>
                                <div className="space-y-1">
                                    {blocking.map((c: PreflightCheck) => (
                                        <div key={c.id} className="flex items-center gap-2 text-[10px] rounded-lg px-2 py-1.5"
                                            style={{ background: "rgba(248,113,113,0.06)", color: "rgba(255,255,255,0.6)" }}>
                                            <span style={{ color: RED }}>⬛ BLOQUEANTE</span>
                                            <span>{c.description}</span>
                                        </div>
                                    ))}
                                    {nonBlock.map((c: PreflightCheck) => (
                                        <div key={c.id} className="flex items-center gap-2 text-[10px] rounded-lg px-2 py-1.5"
                                            style={{ background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.4)" }}>
                                            <span style={{ color: "rgba(255,255,255,0.2)" }}>◻ opcional</span>
                                            <span>{c.description}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Selected modules */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: G }}>
                                    Módulos Selecionados
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(parsed.selectedModules ?? []).map((m: any) => (
                                        <span key={m.key} className="text-[10px] px-2 py-0.5 rounded-full"
                                            style={{ background: `${IND}15`, color: PUR, border: `1px solid ${IND}33` }}>
                                            P{m.priority} · {m.key}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Rollout plan */}
                            {(parsed.rolloutPlan ?? []).length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: G }}>
                                        Rollout Plan
                                    </p>
                                    <div className="grid gap-1.5">
                                        {parsed.rolloutPlan.map((p: any) => (
                                            <div key={p.phase} className="rounded-xl px-3 py-2 flex items-start gap-3"
                                                style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${BORD}` }}>
                                                <span className="text-[10px] font-bold mt-0.5 flex-shrink-0"
                                                    style={{ color: G2 }}>FΊ{p.phase}</span>
                                                <div>
                                                    <p className="text-[10px] font-semibold text-white">{p.name} <span className="font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>({p.duration})</span></p>
                                                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                                                        {p.goals?.join(" · ")}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Raw JSON */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                                        JSON Raw
                                    </p>
                                    <CopyBtn text={json} />
                                </div>
                                <pre className="text-[10px] font-mono leading-relaxed overflow-auto max-h-64 rounded-xl p-3 whitespace-pre-wrap"
                                    style={{ background: "rgba(0,0,0,0.3)", color: "rgba(255,255,255,0.4)", border: `1px solid ${BORD}` }}>
                                    {json}
                                </pre>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Glass>
    );
}

// ─── 3) Prompt Pack Timeline ──────────────────────────────────────────────────
function PromptPackTimeline({ artifacts }: { artifacts: BuildArtifact[] }) {
    const parts = artifacts.filter(a => a.type === "prompt_pack").sort((a, b) => a.version - b.version);
    const [active, setActive] = useState(0);

    if (parts.length === 0) return null;

    return (
        <Glass>
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORD}` }}>
                <p className="text-xs font-semibold text-white">💬 Prompt Pack</p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {parts.length} partes — cole em sequência no Antigravity
                </p>
            </div>

            {/* Timeline rail */}
            <div className="px-4 pt-4 flex items-center gap-1 overflow-x-auto pb-2">
                {parts.map((p, i) => (
                    <button key={p.id} onClick={() => setActive(i)}
                        className="flex-shrink-0 flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition-all"
                        style={{
                            background: active === i ? `${IND}20` : "rgba(255,255,255,0.03)",
                            border: `1px solid ${active === i ? `${IND}55` : BORD}`,
                        }}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                            style={{ background: active === i ? IND : "rgba(255,255,255,0.08)", color: "white" }}>
                            {i + 1}
                        </span>
                        <span className="text-[10px] font-medium" style={{ color: active === i ? PUR : "rgba(255,255,255,0.35)" }}>
                            Parte {i + 1}
                        </span>
                    </button>
                ))}
            </div>

            {/* Active part content */}
            <AnimatePresence mode="wait">
                <motion.div key={active} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                    className="px-4 pb-4">

                    <div className="flex items-center justify-between mt-3 mb-2">
                        <p className="text-[10px] font-bold" style={{ color: G2 }}>
                            Parte {active + 1} / {parts.length} — v{parts[active].version}
                        </p>
                        <div className="flex gap-1.5">
                            <CopyBtn text={parts[active].body} label="📋 Copiar Prompt" />
                            {active > 0 && (
                                <button onClick={() => setActive(a => a - 1)}
                                    className="text-[10px] px-2.5 py-1 rounded-lg"
                                    style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}>
                                    ← Anterior
                                </button>
                            )}
                            {active < parts.length - 1 && (
                                <button onClick={() => setActive(a => a + 1)}
                                    className="text-[10px] px-2.5 py-1 rounded-lg"
                                    style={{ background: `${IND}15`, color: PUR }}>
                                    Próximo →
                                </button>
                            )}
                        </div>
                    </div>

                    <pre className="text-[10px] font-mono leading-relaxed overflow-auto max-h-80 rounded-xl p-4 whitespace-pre-wrap"
                        style={{ background: "rgba(0,0,0,0.35)", color: "rgba(255,255,255,0.6)", border: `1px solid ${BORD}` }}>
                        {parts[active].body}
                    </pre>
                </motion.div>
            </AnimatePresence>
        </Glass>
    );
}

// ─── 4) Review Gate (Approve / Reject) ───────────────────────────────────────
function ReviewGate({ run, orgSlug, onRefresh }: { run: BuildRun; orgSlug: string; onRefresh: () => void }) {
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

    if (!["review", "approved"].includes(run.status)) return null;

    async function approve() {
        setBusy(true); setMsg(null);
        const res = await fetch(`/api/org/${orgSlug}/builder/run/${run.id}/approve`, {
            method: "POST", headers: { "x-builder-role": "admin" },
        });
        const d = await res.json();
        setMsg({ text: res.ok ? "✅ Aprovado com sucesso" : d.error, ok: res.ok });
        setBusy(false);
        if (res.ok) onRefresh();
    }

    async function reject() {
        setBusy(true); setMsg(null);
        const res = await fetch(`/api/org/${orgSlug}/builder/run/${run.id}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-builder-role": "admin" },
            body: JSON.stringify({ reason }),
        });
        const d = await res.json();
        setMsg({ text: res.ok ? "❌ Rejeitado — voltou para draft" : d.error, ok: res.ok });
        setBusy(false);
        setRejecting(false);
        if (res.ok) onRefresh();
    }

    return (
        <Glass className="p-4" style={{ border: `1px solid ${G}33` }}>
            <SectionLabel text="Review Gate" />

            {run.status === "review" && (
                <div className="space-y-3">
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                        Este run está aguardando aprovação humana. Revise os artefatos antes de aprovar.
                    </p>

                    {!rejecting ? (
                        <div className="flex gap-2">
                            <button onClick={approve} disabled={busy}
                                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                                style={{ background: `${GRN}18`, color: GRN, border: `1px solid ${GRN}33` }}>
                                {busy ? "…" : "✅ Aprovar"}
                            </button>
                            <button onClick={() => setRejecting(true)} disabled={busy}
                                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                                style={{ background: `${RED}10`, color: RED, border: `1px solid ${RED}33` }}>
                                ❌ Rejeitar
                            </button>
                        </div>
                    ) : (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                            <Input value={reason} onChange={(e: any) => setReason(e.target.value)}
                                placeholder="Motivo da rejeição (opcional)" />
                            <div className="flex gap-2">
                                <button onClick={reject} disabled={busy}
                                    className="flex-1 py-2 rounded-xl text-xs font-bold"
                                    style={{ background: `${RED}18`, color: RED }}>
                                    {busy ? "…" : "Confirmar Rejeição"}
                                </button>
                                <button onClick={() => setRejecting(false)}
                                    className="px-4 py-2 rounded-xl text-xs"
                                    style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }}>
                                    Cancelar
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {msg && (
                        <p className="text-xs rounded-xl px-3 py-2"
                            style={{ background: msg.ok ? `${GRN}10` : `${RED}10`, color: msg.ok ? GRN : RED }}>
                            {msg.text}
                        </p>
                    )}
                </div>
            )}

            {run.status === "approved" && (
                <p className="text-xs" style={{ color: GRN }}>
                    ✅ Run aprovado. Aguardando execução (autopilot ou manual).
                </p>
            )}
        </Glass>
    );
}

// ─── 5) Audit Trail ──────────────────────────────────────────────────────────
function AuditTrail({ run }: { run: BuildRun }) {
    const events = [
        { time: run.createdAt, label: "Run criado", color: G2, icon: "✏️" },
        ...(run.status !== "draft" ? [{ time: run.updatedAt, label: `Status: ${run.status}`, color: STATUS_META[run.status]?.color ?? G2, icon: STATUS_META[run.status]?.emoji ?? "•" }] : []),
    ].reverse();

    const out: { time: string; label: string; color: string; icon: string }[] = events;
    const extraArtifacts = (run.artifacts || []).map(a => ({
        time: a.createdAt,
        label: `Artefato: ${a.type} v${a.version}`,
        color: IND,
        icon: "📄",
    }));
    const all = [...out, ...extraArtifacts].sort((a, b) => b.time.localeCompare(a.time));

    return (
        <Glass>
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORD}` }}>
                <p className="text-xs font-semibold text-white">📋 Audit Trail</p>
            </div>
            <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                {all.length === 0 && (
                    <p className="text-[10px] text-center py-4" style={{ color: "rgba(255,255,255,0.2)" }}>Sem eventos</p>
                )}
                {all.map((e, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] mt-0.5"
                            style={{ background: `${e.color}18`, border: `1px solid ${e.color}33` }}>
                            {e.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>{e.label}</p>
                            <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                                {new Date(e.time).toLocaleString("pt-BR")}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </Glass>
    );
}

// ─── Run Detail View ──────────────────────────────────────────────────────────
function RunDetail({ run, orgSlug, onRefresh, onClose }: { run: BuildRun; orgSlug: string; onRefresh: () => void; onClose: () => void }) {
    const [generating, setGenerating] = useState(false);
    const [transitioning, setTransitioning] = useState(false);

    async function generate() {
        setGenerating(true);
        await fetch(`/api/org/${orgSlug}/builder/run/${run.id}/generate`, {
            method: "POST", headers: { "x-builder-role": "admin" },
        });
        setGenerating(false); onRefresh();
    }

    async function transition(to: string) {
        setTransitioning(true);
        await fetch(`/api/org/${orgSlug}/builder/run/${run.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-builder-role": "admin" },
            body: JSON.stringify({ status: to }),
        });
        setTransitioning(false); onRefresh();
    }

    const STATUS_NEXT: Record<string, string[]> = {
        draft: ["review", "failed"],
        review: ["approved", "draft"],
        approved: ["executing", "draft"],
        executing: ["done", "failed"],
        failed: ["draft"],
    };
    const nextOptions = STATUS_NEXT[run.status] ?? [];

    // Blueprint from output
    let blueprintJson: string | null = null;
    try {
        const out = JSON.parse(run.outputJson ?? "{}");
        if (out.blueprint) blueprintJson = JSON.stringify(out.blueprint, null, 2);
    } catch { }

    const promptArtifacts = run.artifacts?.filter(a => a.type === "prompt_pack") ?? [];
    const otherArtifacts = run.artifacts?.filter(a => a.type !== "prompt_pack") ?? [];

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="space-y-4">

            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={onClose}
                    className="text-[10px] px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>
                    ← Voltar
                </button>
                <div className="flex-1">
                    <p className="text-xs font-semibold text-white">{MODE_META[run.mode]?.label}</p>
                    <p className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>{run.id}</p>
                </div>
                <StatusBadge status={run.status} />
            </div>

            {/* Action bar */}
            <div className="flex flex-wrap gap-2">
                {run.status === "draft" && (
                    <button onClick={generate} disabled={generating}
                        className="text-xs px-4 py-2 rounded-xl font-bold"
                        style={{ background: `${G}18`, color: G2, border: `1px solid ${G}33` }}>
                        {generating ? "Gerando…" : "⚡ Gerar Artefatos"}
                    </button>
                )}
                {nextOptions.filter(s => !["approved", "rejected"].includes(s)).map(to => (
                    <button key={to} onClick={() => transition(to)} disabled={transitioning}
                        className="text-[10px] px-3 py-1.5 rounded-xl"
                        style={{
                            background: `${STATUS_META[to]?.color ?? IND}12`,
                            color: STATUS_META[to]?.color ?? IND,
                        }}>
                        → {to}
                    </button>
                ))}
            </div>

            {/* Section 4: Review Gate */}
            <ReviewGate run={run} orgSlug={orgSlug} onRefresh={onRefresh} />

            {/* Section 2: Blueprint */}
            {blueprintJson && <BlueprintViewer json={blueprintJson} />}

            {/* Section 3: Prompt Pack timeline */}
            {promptArtifacts.length > 0 && <PromptPackTimeline artifacts={promptArtifacts} />}

            {/* Other artifacts */}
            {otherArtifacts.length > 0 && (
                <Glass className="p-4 space-y-3">
                    <SectionLabel text="Outros Artefatos" />
                    {otherArtifacts.map(a => (
                        <div key={a.id}>
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[10px] font-bold" style={{ color: G2 }}>{a.type} · v{a.version}</p>
                                <CopyBtn text={a.body} />
                            </div>
                            <pre className="text-[10px] font-mono leading-relaxed overflow-auto max-h-48 rounded-xl p-3 whitespace-pre-wrap"
                                style={{ background: "rgba(0,0,0,0.3)", color: "rgba(255,255,255,0.5)", border: `1px solid ${BORD}` }}>
                                {a.body}
                            </pre>
                        </div>
                    ))}
                </Glass>
            )}

            {/* Section 5: Audit trail */}
            <AuditTrail run={run} />
        </motion.div>
    );
}

// ─── Run List ─────────────────────────────────────────────────────────────────
function RunList({ runs, onSelect }: { runs: BuildRun[]; onSelect: (r: BuildRun) => void }) {
    if (runs.length === 0) return (
        <p className="text-xs text-center py-16" style={{ color: "rgba(255,255,255,0.2)" }}>
            Nenhum run criado ainda.<br />
            <span style={{ color: "rgba(255,255,255,0.12)" }}>Use o formulário acima para criar.</span>
        </p>
    );

    return (
        <div className="space-y-2">
            {runs.map(r => {
                const m = STATUS_META[r.status] ?? STATUS_META.draft;
                return (
                    <motion.button key={r.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        onClick={() => onSelect(r)}
                        className="w-full text-left rounded-2xl px-4 py-3 flex items-center gap-3 transition-all"
                        style={{ background: CARD, border: `1px solid ${m.color}22` }}>
                        <div className="w-1.5 h-7 rounded-full flex-shrink-0" style={{ background: m.color }} />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">
                                {MODE_META[r.mode]?.label}
                                {r.targetOrgSlug && <span className="ml-1.5 font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>→ {r.targetOrgSlug}</span>}
                            </p>
                            <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                                {r.id}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {r.artifacts?.length > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded"
                                    style={{ background: `${IND}18`, color: PUR }}>
                                    {r.artifacts.length} artefatos
                                </span>
                            )}
                            <StatusBadge status={r.status} />
                            <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                                {new Date(r.createdAt).toLocaleString("pt-BR")}
                            </p>
                            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>›</span>
                        </div>
                    </motion.button>
                );
            })}
        </div>
    );
}

// ─── Template Library ─────────────────────────────────────────────────────────
function TemplateLibrary({ orgSlug }: { orgSlug: string }) {
    const [templates, setTemplates] = useState<BuildTemplate[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [editing, setEditing] = useState<BuildTemplate | null>(null);
    const [creating, setCreating] = useState(false);
    const [newKey, setNewKey] = useState("");
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [newBlue, setNewBlue] = useState('{\n  "steps": []\n}');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const load = useCallback(async () => {
        const res = await fetch(`/api/org/${orgSlug}/builder/templates`, { headers: { "x-builder-role": "admin" } });
        const data = await res.json();
        setTemplates(data.templates ?? []); setLoaded(true);
    }, [orgSlug]);

    useEffect(() => { load(); }, [load]);

    async function save() {
        setSaving(true); setMsg(null);
        const body = editing
            ? { key: editing.key, name: editing.name, description: editing.description, blueprintJson: newBlue }
            : { key: newKey, name: newName, description: newDesc, blueprintJson: newBlue };
        const res = await fetch(`/api/org/${orgSlug}/builder/templates`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-builder-role": "admin" },
            body: JSON.stringify(body),
        });
        setSaving(false);
        setMsg(res.ok ? "✅ Salvo" : "Erro ao salvar");
        if (res.ok) { load(); setEditing(null); setCreating(false); setNewKey(""); setNewName(""); setNewDesc(""); }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <SectionLabel text={`Templates (${templates.length})`} />
                <button onClick={() => { setCreating(true); setEditing(null); }}
                    className="text-[10px] px-3 py-1.5 rounded-xl font-semibold"
                    style={{ background: `${G}18`, color: G2, border: `1px solid ${G}33` }}>
                    + Novo Template
                </button>
            </div>

            {/* List */}
            <div className="space-y-2">
                {!loaded && <p className="text-xs text-center py-6" style={{ color: "rgba(255,255,255,0.2)" }}>Carregando…</p>}
                {templates.map(t => (
                    <Glass key={t.id} className="px-4 py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white">{t.name}</p>
                            <p className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{t.key} · v{t.version}</p>
                            {t.description && <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>{t.description}</p>}
                        </div>
                        <button onClick={() => { setEditing(t); setNewBlue("{}"); setCreating(false); setMsg(null); }}
                            className="text-[10px] px-2.5 py-1 rounded-lg flex-shrink-0"
                            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>
                            Editar
                        </button>
                    </Glass>
                ))}
            </div>

            {/* Create / Edit form */}
            <AnimatePresence>
                {(creating || editing) && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                        <Glass className="p-5 space-y-3" style={{ border: `1px solid ${G}22` }}>
                            <p className="text-xs font-bold" style={{ color: G2 }}>
                                {editing ? `Editar: ${editing.key}` : "Novo Template"}
                            </p>
                            {!editing && <>
                                <Input value={newKey} onChange={(e: any) => setNewKey(e.target.value)} placeholder="key (ex: clinic_stack_v2)" mono />
                                <Input value={newName} onChange={(e: any) => setNewName(e.target.value)} placeholder="Nome legível" />
                            </>}
                            {editing && (
                                <Input value={editing.name} onChange={(e: any) => setEditing({ ...editing, name: e.target.value })} placeholder="Nome legível" />
                            )}
                            <Input
                                value={editing ? editing.description : newDesc}
                                onChange={(e: any) => editing ? setEditing({ ...editing, description: e.target.value }) : setNewDesc(e.target.value)}
                                placeholder="Descrição" />
                            <div>
                                <p className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                                    blueprintJson {editing ? "(update — será nova versão)" : ""}
                                </p>
                                <Textarea value={newBlue} onChange={(e: any) => setNewBlue(e.target.value)} rows={6} />
                            </div>
                            {msg && <p className="text-[10px]" style={{ color: msg.startsWith("✅") ? GRN : RED }}>{msg}</p>}
                            <div className="flex gap-2">
                                <button onClick={save} disabled={saving}
                                    className="flex-1 py-2 rounded-xl text-xs font-bold"
                                    style={{ background: `${G}18`, color: G2 }}>
                                    {saving ? "Salvando…" : "Salvar"}
                                </button>
                                <button onClick={() => { setCreating(false); setEditing(null); setMsg(null); }}
                                    className="px-4 py-2 rounded-xl text-xs"
                                    style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}>
                                    Cancelar
                                </button>
                            </div>
                        </Glass>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Top Stats Bar ────────────────────────────────────────────────────────────
function StatsBar({ runs }: { runs: BuildRun[] }) {
    const counts: Record<string, number> = {};
    for (const r of runs) counts[r.status] = (counts[r.status] ?? 0) + 1;
    const total = runs.length;

    return (
        <div className="flex gap-3 overflow-x-auto pb-1">
            {[
                { label: "Total", value: total, color: "rgba(255,255,255,0.5)" },
                { label: "Draft", value: counts.draft ?? 0, color: STATUS_META.draft.color },
                { label: "Revisão", value: counts.review ?? 0, color: STATUS_META.review.color },
                { label: "Aprovado", value: counts.approved ?? 0, color: STATUS_META.approved.color },
                { label: "Concluído", value: counts.done ?? 0, color: STATUS_META.done.color },
            ].map(s => (
                <div key={s.label} className="flex-shrink-0 rounded-xl px-4 py-2.5 text-center min-w-[70px]"
                    style={{ background: CARD, border: `1px solid ${s.color}22` }}>
                    <p className="text-base font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</p>
                </div>
            ))}
        </div>
    );
}

// ─── Main BuilderClient ───────────────────────────────────────────────────────
export function BuilderClient({ orgSlug }: Props) {
    const [tab, setTab] = useState<"runs" | "templates">("runs");
    const [runs, setRuns] = useState<BuildRun[]>([]);
    const [loading, setLoading] = useState(false);
    const [sel, setSel] = useState<BuildRun | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    const loadRuns = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`/api/org/${orgSlug}/builder/run`, { headers: { "x-builder-role": "admin" } });
        const data = await res.json();
        // After refreshing, update selected run too
        const freshRuns: BuildRun[] = data.runs ?? [];
        setRuns(freshRuns);
        if (sel) setSel(freshRuns.find(r => r.id === sel.id) ?? null);
        setLoading(false);
    }, [orgSlug, sel]);

    useEffect(() => { loadRuns(); }, []);

    return (
        <div className="min-h-screen antialiased" style={{ background: BG, color: "#e2e2ea", fontFamily: "Inter,system-ui,sans-serif" }}>

            {/* Top bar */}
            <div className="sticky top-0 z-30 px-6 py-3 flex items-center gap-3"
                style={{ background: "rgba(11,11,15,0.92)", borderBottom: `1px solid ${BORD}`, backdropFilter: "blur(24px)" }}>

                <div className="w-0.5 h-5 rounded-full" style={{ background: `linear-gradient(to bottom,${G2},${G})` }} />
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: G }}>Builder Autopilot</p>
                <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.1)", color: RED, border: "1px solid rgba(239,68,68,0.2)" }}>
                    INTERNAL ONLY
                </span>

                {/* Tabs */}
                <div className="flex gap-1 ml-4">
                    {(["runs", "templates"] as const).map(t => (
                        <button key={t} onClick={() => { setTab(t); setSel(null); setShowCreate(false); }}
                            className="text-[10px] px-3 py-1.5 rounded-xl transition-all"
                            style={{
                                background: tab === t ? `${G}18` : "rgba(255,255,255,0.04)",
                                color: tab === t ? G2 : "rgba(255,255,255,0.3)",
                            }}>
                            {t === "runs" ? "Build Runs" : "Templates"}
                        </button>
                    ))}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {tab === "runs" && !sel && (
                        <button onClick={() => setShowCreate(c => !c)}
                            className="text-[10px] px-3 py-1.5 rounded-xl font-semibold transition-all"
                            style={{
                                background: showCreate ? `${IND}20` : `${G}18`,
                                color: showCreate ? PUR : G2,
                                border: `1px solid ${showCreate ? IND + "44" : G + "33"}`,
                            }}>
                            {showCreate ? "× Fechar" : "+ Novo Run"}
                        </button>
                    )}
                    <button onClick={loadRuns} disabled={loading}
                        className="text-[10px] px-2.5 py-1 rounded-lg"
                        style={{ color: loading ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)" }}>
                        {loading ? "↻" : "Atualizar"}
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
                {tab === "runs" && (
                    <>
                        {/* Stats */}
                        {!sel && <StatsBar runs={runs} />}

                        {/* Create form */}
                        <AnimatePresence>
                            {showCreate && !sel && (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                                    <CreateRunForm orgSlug={orgSlug} onCreated={() => { loadRuns(); setShowCreate(false); }} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Detail or list */}
                        <AnimatePresence mode="wait">
                            {sel ? (
                                <RunDetail key={sel.id} run={sel} orgSlug={orgSlug}
                                    onRefresh={loadRuns}
                                    onClose={() => setSel(null)} />
                            ) : (
                                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <RunList runs={runs} onSelect={r => { setSel(r); setShowCreate(false); }} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}

                {tab === "templates" && <TemplateLibrary orgSlug={orgSlug} />}
            </div>
        </div>
    );
}
