"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Activity, Loader2, Medal, TrendingUp, Trophy } from "lucide-react";

type TeamMember = {
    userId: string;
    name: string;
    totalConversations: number;
    openConversations: number;
    avgResponseTimeMinutes: number;
};

function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}

export function TeamTab() {
    const params = useParams();
    const slug = params.slug as string;
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTeam() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/org/${slug}/whatsapp/team`);
                if (!res.ok) throw new Error("Falha ao carregar performance do time");
                const data = await res.json();
                setTeam(data.team || []);
            } catch (err: unknown) {
                setError(getErrorMessage(err, "Erro inesperado"));
            } finally {
                setLoading(false);
            }
        }
        fetchTeam();
    }, [slug]);

    const aggregate = useMemo(() => {
        const totalConversations = team.reduce((acc, member) => acc + member.totalConversations, 0);
        const totalOpen = team.reduce((acc, member) => acc + member.openConversations, 0);
        const avgResponse = team.length > 0
            ? Math.round(team.reduce((acc, member) => acc + member.avgResponseTimeMinutes, 0) / team.length)
            : 0;
        return { totalConversations, totalOpen, avgResponse };
    }, [team]);

    const top = team[0] ?? null;

    return (
        <div className="p-8 flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-bold text-white/90">Performance do Time</h2>
                    <p className="text-sm text-white/40 mt-1">Distribuição operacional real das conversas do WhatsApp CRM.</p>
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gold/40" />
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    <div className="xl:col-span-3 flex flex-col gap-4">
                        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-white/5 bg-white/[0.02]">
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/30">Posição</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/30">Agente</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/30 text-center">Atendimentos</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/30 text-center">Abertos</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Tempo Médio</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                    {team.map((member, idx) => (
                                        <tr key={member.userId} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {idx === 0 ? <Medal className="w-5 h-5 text-gold" /> :
                                                        idx === 1 ? <Medal className="w-5 h-5 text-zinc-400" /> :
                                                            idx === 2 ? <Medal className="w-5 h-5 text-amber-700" /> :
                                                                <span className="text-sm font-bold text-white/20 ml-1">#{idx + 1}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 text-[10px] font-bold">
                                                        {(member.name || "A").charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-bold text-white/80 group-hover:text-gold transition-colors">{member.name || "Agente"}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-mono text-white/60">{member.totalConversations}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/40">
                                                    {member.openConversations}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-sm font-mono text-gold/80">
                                                    {member.avgResponseTimeMinutes} min
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {team.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-10 text-center text-sm text-white/30">
                                                Nenhum agente com conversas atribuídas no período atual.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex flex-col gap-6">
                        <div className="bg-gradient-to-br from-gold/10 to-amber-600/10 border border-gold/20 rounded-3xl p-6 relative overflow-hidden">
                            <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-gold/5" />
                            <Trophy className="w-8 h-8 text-gold mb-4" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gold/60">Top Performer</h4>
                            <p className="text-lg font-black text-white/90 mt-1">{top?.name || "Ninguém"}</p>
                            <p className="text-xs text-white/40 mt-2">
                                {top ? `${top.totalConversations} conversas, ${top.avgResponseTimeMinutes} min médios` : "Sem dados suficientes"}
                            </p>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <Activity className="w-8 h-8 text-white/20 mb-4" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Atividade Geral</h4>
                            <div className="mt-4 flex flex-col gap-3 text-[11px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-white/30">Conversas atribuídas</span>
                                    <span className="text-white/60 font-mono">{aggregate.totalConversations}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-white/30">Conversas abertas</span>
                                    <span className="text-white/60 font-mono">{aggregate.totalOpen}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-white/30">Tempo médio de resposta</span>
                                    <span className="text-white/60 font-mono">{aggregate.avgResponse} min</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
