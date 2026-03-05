import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { StubPayButton } from "./stub-pay-button";
import { DollarSign, Package, ShieldCheck } from "lucide-react";

export const runtime = "nodejs";

function formatBRL(n: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

/**
 * /org/[slug]/billing/stub/[proposalId]
 * Stub payment page for dev/test (when no STRIPE_SECRET_KEY).
 */
export default async function StubBillingPage({
    params,
}: {
    params: Promise<{ slug: string; proposalId: string }>;
}) {
    const { slug, proposalId } = await params;

    const billing = await (prisma as any).billingRecord.findUnique({
        where: { proposalId },
    });

    if (!billing) notFound();

    const proposal = await (prisma as any).proposal.findUnique({
        where: { id: proposalId },
        include: { assessment: { select: { company: true } } },
    });

    const isPaid = ["paid", "stub_paid"].includes(billing.status);
    const amountBRL = billing.amountCents / 100;
    const modules = (() => {
        try { return JSON.parse(proposal?.modules ?? "[]").filter((m: any) => m.included !== false); }
        catch { return []; }
    })();

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
            <div className="w-full max-w-md glass-panel rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-8 space-y-6">
                {/* Dev banner */}
                <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Modo STUB — sem cobranças reais (ambiente de desenvolvimento)
                </div>

                <div className="text-center">
                    <DollarSign className="w-10 h-10 text-green-500 mx-auto mb-3" />
                    <h1 className="text-2xl font-black mb-1">Pagamento STUB</h1>
                    <p className="text-muted-foreground text-sm">{proposal?.assessment?.company ?? "Cliente"}</p>
                </div>

                <div className="rounded-xl border border-border/50 p-5 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Valor</span>
                        <span className="text-xl font-black text-green-500">{formatBRL(amountBRL)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPaid ? "bg-green-500/20 text-green-500" : "bg-yellow-400/20 text-yellow-400"}`}>
                            {isPaid ? "Pago" : "Pendente"}
                        </span>
                    </div>

                    {modules.length > 0 && (
                        <div className="pt-3 border-t border-border/30">
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                <Package className="w-3 h-3" /> Módulos incluídos:
                            </p>
                            <ul className="space-y-1">
                                {modules.map((m: any, i: number) => (
                                    <li key={i} className="text-xs flex items-start gap-1.5 text-foreground/80">
                                        <span className="text-primary mt-0.5">•</span> {m.title}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {isPaid ? (
                    <div className="text-center py-4">
                        <p className="text-green-500 font-bold">✅ Pagamento já confirmado</p>
                        <p className="text-xs text-muted-foreground mt-1">Onboarding foi acionado automaticamente.</p>
                    </div>
                ) : (
                    <StubPayButton proposalId={proposalId} />
                )}
            </div>
        </div>
    );
}
