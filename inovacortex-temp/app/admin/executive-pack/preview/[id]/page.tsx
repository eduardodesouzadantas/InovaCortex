/**
 * app/admin/executive-pack/preview/[id]/page.tsx
 * V24: Puppeteer-navigable printable static preview of an executive pack.
 *
 * When ?pdf=true, hides all interactive controls.
 * Accessed by /api/pdf/executive-pack/[id] for PDF generation.
 */

import { notFound } from "next/navigation";

export const runtime = "nodejs";

async function getPack(id: string) {
    const { prisma } = await import("@/lib/prisma");
    const pack = await (prisma as any).execPack.findFirst({
        where: { OR: [{ id }, { publicSlug: id }] },
    }).catch(() => null);
    return pack;
}

export default async function ExecPackPreviewPage({
    params, searchParams,
}: {
    params: { id: string };
    searchParams: { pdf?: string };
}) {
    const pack = await getPack(params.id);
    if (!pack) notFound();

    const payload = JSON.parse(pack.payloadJson);
    const isPdf = searchParams.pdf === "true";
    const anon = payload.anonymized;

    const GOLD = "#d4af37";
    const GOLD2 = "#f5cc5a";
    const IND = "#6366f1";

    function fmtBRL(cents: number) {
        const v = cents / 100;
        if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
        if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
        return `R$ ${v.toFixed(0)}`;
    }
    function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }

    return (
        <html lang="pt-BR">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>InovaCortex Executive Pack</title>
                <style>{`
                * { box-sizing:border-box; margin:0; padding:0; }
                body { background:#0b0b0f; color:#e2e2ea; font-family:system-ui,-apple-system,sans-serif; padding:40px 48px; }
                h1 { font-size:28px; font-weight:900; color:white; margin-bottom:4px; }
                h2 { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.18em; color:${GOLD}; margin-bottom:14px; }
                .meta { font-size:11px; color:rgba(255,255,255,0.3); margin-bottom:32px; }
                .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; }
                .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:24px; }
                .card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:20px; }
                .card-gold { border-color:rgba(212,175,55,0.25); }
                .kpi { text-align:center; padding:14px; }
                .kpi .val { font-size:22px; font-weight:900; }
                .kpi .lbl { font-size:10px; color:rgba(255,255,255,0.35); margin-top:3px; }
                .row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px; }
                .row:last-child { border-bottom:none; }
                .tag { display:inline-block; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:700; }
                .bar-track { background:rgba(255,255,255,0.06); border-radius:4px; height:6px; margin-top:4px; }
                .bar-fill  { height:100%; border-radius:4px; background:linear-gradient(90deg,${IND},${GOLD}); }
                .narrative { white-space:pre-wrap; font-size:12px; color:rgba(255,255,255,0.6); line-height:1.7; background:rgba(255,255,255,0.03); border:1px solid rgba(212,175,55,0.15); border-radius:14px; padding:18px; }
                .divider { height:1px; background:rgba(255,255,255,0.05); margin:24px 0; }
                .footer { font-size:10px; color:rgba(255,255,255,0.15); text-align:center; margin-top:32px; }
            `}</style>
            </head>
            <body>
                {/* Header */}
                <h1>Executive Pack</h1>
                <p className="meta">
                    InovaCortex Intelligence · {new Date(payload.generatedAt).toLocaleString("pt-BR")} · Janela: 30 dias
                    {anon ? " · Dados anonimizados" : ""}
                </p>

                {/* KPIs */}
                <h2>KPIs — Visão Geral</h2>
                <div className="grid3" style={{ marginBottom: 24 }}>
                    {[
                        { l: "Receita 30d", v: fmtBRL(payload.kpi.revenueClosed30dCents), c: GOLD2 },
                        { l: "Ticket médio", v: fmtBRL(payload.kpi.avgTicketCents), c: "#4ade80" },
                        { l: "Conversão", v: pct(payload.kpi.conversionRate), c: IND },
                        { l: "Hot Leads", v: String(payload.kpi.hotLeads), c: "#fb923c" },
                        { l: "Reuniões", v: String(payload.kpi.meetingsScheduled), c: "#a78bfa" },
                        { l: "Fechamentos", v: String(payload.kpi.dealsClosedCount), c: "#4ade80" },
                    ].map(item => (
                        <div key={item.l} className="card kpi">
                            <div className="val" style={{ color: item.c }}>{item.v}</div>
                            <div className="lbl">{item.l}</div>
                        </div>
                    ))}
                </div>

                <div className="grid2">
                    {/* Funnel */}
                    <div className="card card-gold">
                        <h2>Funil 30d</h2>
                        {payload.funnel.map((s: any) => (
                            <div key={s.label} style={{ marginBottom: 10 }}>
                                <div className="row" style={{ border: "none", padding: "2px 0" }}>
                                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{s.label}</span>
                                    <span style={{ color: GOLD2, fontWeight: 700, fontSize: 12 }}>{s.count}</span>
                                </div>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${(s.pct ?? 1) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Leaks */}
                    <div className="card" style={{ borderColor: "rgba(248,113,113,0.2)" }}>
                        <h2>Profit Leaks (Top 5)</h2>
                        {payload.leaks.length === 0
                            ? <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>Sem leaks ativos.</p>
                            : payload.leaks.map((l: any) => (
                                <div key={l.rank} className="row">
                                    <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>#{l.rank} {l.title}</span>
                                    <span style={{ color: "#f87171", fontWeight: 700, fontSize: 11 }}>{fmtBRL(l.estimatedLossCents)}</span>
                                </div>
                            ))
                        }
                    </div>
                </div>

                <div className="grid2">
                    {/* Team */}
                    <div className="card card-gold">
                        <h2>Ranking da Equipe</h2>
                        {payload.team.map((m: any, i: number) => (
                            <div key={m.rank} className="row">
                                <span style={{ color: i === 0 ? GOLD2 : "rgba(255,255,255,0.5)", fontSize: 11 }}>
                                    {["🥇", "🥈", "🥉"][i] ?? `#${i + 1}`} {m.name}
                                </span>
                                <span style={{ color: GOLD, fontWeight: 700, fontSize: 11 }}>{fmtBRL(m.revenueCents)}</span>
                            </div>
                        ))}
                    </div>

                    {/* Forecast */}
                    <div className="card" style={{ borderColor: "rgba(74,222,128,0.2)" }}>
                        <h2>Forecast Próximos 30–60d</h2>
                        {payload.forecast.map((f: any) => (
                            <div key={f.label} className="row">
                                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{f.label}</span>
                                <span style={{ color: "#4ade80", fontWeight: 700, fontSize: 12 }}>{fmtBRL(f.projectedCents)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid2">
                    {/* Proof */}
                    <div className="card" style={{ borderColor: "rgba(167,139,250,0.2)" }}>
                        <h2>Proof of Authority</h2>
                        {[
                            { l: "Diagnósticos", v: payload.proof.totalAssessmentsAllTime },
                            { l: "Propostas geradas", v: payload.proof.totalProposalsGenerated },
                            { l: "PDFs baixados", v: payload.proof.totalPdfDownloads },
                            { l: "Engajamento", v: pct(payload.proof.npsProxy) },
                            { l: "Uptime", v: `${payload.proof.uptimePct}%` },
                        ].map(s => (
                            <div key={s.l} className="row">
                                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{s.l}</span>
                                <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: 11 }}>{s.v}</span>
                            </div>
                        ))}
                    </div>

                    {/* Work Items */}
                    <div className="card" style={{ borderColor: "rgba(52,211,153,0.2)" }}>
                        <h2>Entregas do Mês</h2>
                        {payload.workItems.map((w: any) => (
                            <div key={w.id} className="row">
                                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>{w.title}</span>
                                <span className="tag" style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>{w.status}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="divider" />

                {/* Board summary */}
                <h2>Board Summary</h2>
                <div className="narrative">{payload.narrative}</div>

                <div className="footer">
                    InovaCortex Intelligence Platform · Confidencial · Uso exclusivo executivo
                </div>
            </body>
        </html>
    );
}
