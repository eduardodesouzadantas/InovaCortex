/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { DollarSign, FileText, RotateCcw, ExternalLink, CheckCircle2, Clock, AlertTriangle, Send } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingPanelProps {
    billing: {
        id: string;
        status: string;
        amountCents: number;
        currency: string;
        checkoutUrl: string | null;
        paidAt: string | null;
        createdAt: string;
    } | null;
    contract: {
        id: string;
        status: string;
        publicSlug: string;
        signedName: string | null;
        signedEmail: string | null;
        signedAt: string | null;
        createdAt: string;
    } | null;
    proposalId: string;
    apiBasePath?: string;
}

// ─── Status helpers ────────────────────────────────────────────────────────────

function formatBRL(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function BillingBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string; Icon: any }> = {
        pending: { label: "Aguardando Pagamento", className: "bg-yellow-400/20 text-yellow-400 border-yellow-400/30", Icon: Clock },
        paid: { label: "Pago", className: "bg-green-500/20 text-green-500 border-green-500/30", Icon: CheckCircle2 },
        stub_paid: { label: "Pago (STUB)", className: "bg-blue-400/20 text-blue-400 border-blue-400/30", Icon: CheckCircle2 },
        failed: { label: "Falhou", className: "bg-red-500/20 text-red-500 border-red-500/30", Icon: AlertTriangle },
        refunded: { label: "Reembolsado", className: "bg-orange-400/20 text-orange-400 border-orange-400/30", Icon: RotateCcw },
    };
    const c = config[status] ?? config.pending;
    const { Icon } = c;
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${c.className}`}>
            <Icon className="w-3 h-3" /> {c.label}
        </span>
    );
}

function ContractBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string }> = {
        draft: { label: "Rascunho", className: "bg-gray-500/20 text-gray-400" },
        signed: { label: "Assinado", className: "bg-green-500/20 text-green-500" },
        sent: { label: "Enviado", className: "bg-blue-400/20 text-blue-400" },
        canceled: { label: "Cancelado", className: "bg-red-500/20 text-red-500" },
    };
    const c = config[status] ?? config.draft;
    return (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.className}`}>{c.label}</span>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BillingPanel({
    billing,
    contract,
    proposalId,
    apiBasePath = "/api/admin",
}: BillingPanelProps) {
    const [rechargeLoading, setRechargeLoading] = useState(false);
    const [onboardingLoading, setOnboardingLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

    const handleResendCharge = async () => {
        if (!billing) return;
        setRechargeLoading(true);
        setFeedback(null);
        try {
            const res = await fetch(`${apiBasePath}/billing/${billing.id}/resend`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setFeedback({ type: "success", msg: "Cobrança reenviada." });
        } catch (err: any) {
            setFeedback({ type: "error", msg: err.message });
        } finally {
            setRechargeLoading(false);
        }
    };

    const handleResendOnboarding = async () => {
        setOnboardingLoading(true);
        setFeedback(null);
        try {
            const res = await fetch(`${apiBasePath}/billing/${billing?.id ?? proposalId}/resend-onboarding`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setFeedback({ type: "success", msg: "Onboarding reenviado." });
        } catch (err: any) {
            setFeedback({ type: "error", msg: err.message });
        } finally {
            setOnboardingLoading(false);
        }
    };

    if (!billing && !contract) return null;

    return (
        <div className="glass-panel rounded-xl border border-green-500/20 bg-green-500/5 p-6 space-y-5">
            <h3 className="font-bold text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                Financeiro & Contrato
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Billing Status */}
                {billing && (
                    <div className="space-y-2 bg-background/40 rounded-xl p-4 border border-border/40">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Pagamento</p>
                        <BillingBadge status={billing.status} />
                        <p className="text-xl font-black text-green-500">{formatBRL(billing.amountCents)}</p>
                        {billing.paidAt && (
                            <p className="text-xs text-muted-foreground">
                                Pago em {new Date(billing.paidAt).toLocaleDateString("pt-BR")}
                            </p>
                        )}
                        {billing.checkoutUrl && !["paid", "stub_paid"].includes(billing.status) && (
                            <a
                                href={billing.checkoutUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline mt-1"
                            >
                                <ExternalLink className="w-3 h-3" /> Abrir link de pagamento
                            </a>
                        )}
                    </div>
                )}

                {/* Contract Status */}
                {contract && (
                    <div className="space-y-2 bg-background/40 rounded-xl p-4 border border-border/40">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Contrato</p>
                        <ContractBadge status={contract.status} />
                        {contract.signedName && (
                            <div className="text-xs text-muted-foreground">
                                <p>Assinado por: <span className="font-medium text-foreground">{contract.signedName}</span></p>
                                <p>{contract.signedEmail}</p>
                                {contract.signedAt && (
                                    <p>{new Date(contract.signedAt).toLocaleDateString("pt-BR", {
                                        day: "2-digit", month: "short", year: "numeric",
                                        hour: "2-digit", minute: "2-digit",
                                    })}</p>
                                )}
                            </div>
                        )}
                        <a
                            href={`/contrato/${contract.publicSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                            <FileText className="w-3 h-3" /> Ver contrato
                        </a>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
                {billing && !["paid", "stub_paid"].includes(billing.status) && (
                    <button
                        onClick={handleResendCharge}
                        disabled={rechargeLoading}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-yellow-400/30 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition disabled:opacity-50"
                    >
                        {rechargeLoading ? (
                            <span className="animate-spin">↻</span>
                        ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Reenviar Cobrança
                    </button>
                )}
                <button
                    onClick={handleResendOnboarding}
                    disabled={onboardingLoading}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-blue-400/30 bg-blue-400/10 text-blue-400 hover:bg-blue-400/20 transition disabled:opacity-50"
                >
                    {onboardingLoading ? (
                        <span className="animate-spin">↻</span>
                    ) : (
                        <Send className="w-3.5 h-3.5" />
                    )}
                    Reenviar Onboarding
                </button>
            </div>

            {/* Feedback */}
            {feedback && (
                <p className={`text-sm ${feedback.type === "success" ? "text-green-500" : "text-red-400"}`}>
                    {feedback.type === "success" ? "✅" : "❌"} {feedback.msg}
                </p>
            )}
        </div>
    );
}
