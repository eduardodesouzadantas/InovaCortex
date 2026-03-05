"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
    Users,
    Trophy,
    MessageSquare,
    Clock,
    TrendingUp,
    Loader2,
    Medal,
    Activity
} from "lucide-react";

export function TeamTab() {
    const params = useParams();
    const slug = params.slug as string;
    const [team, setTeam] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTeam() {
            try {
                const res = await fetch(`/api/org/${slug}/whatsapp/team`);
                const data = await res.json();
                setTeam(data.team || []);
            } catch (err) {
                console.error("Failed to fetch team:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchTeam();
    }, [slug]);

    return (
        <div className="p-8 flex flex-col h-full overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-bold text-white/90">Performance do Time</h2>
                    <p className="text-sm text-white/40 mt-1">Leaderboard de atendimento e eficiência do WhatsApp CRM.</p>
                </div>
                <div className="flex bg-white/5 p-1 rounded-xl">
                    <button className="px-4 py-1.5 bg-gold text-black rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg">Hoje</button>
                    <button className="px-4 py-1.5 text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-white/60">Semana</button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gold/40" />
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    {/* Main Leaderboard Table */}
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
                                                        {member.name.charAt(0)}
                                                    </div>
                                                    <span className="text-sm font-bold text-white/80 group-hover:text-gold transition-colors">{member.name}</span>
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
                                                <div className="flex items-center justify-end gap-2 text-sm font-mono text-gold/80">
                                                    <Clock className="w-3.5 h-3.5 text-gold/40" />
                                                    {member.avgResponseTimeMinutes} min
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Side KPI cards */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-gradient-to-br from-gold/10 to-amber-600/10 border border-gold/20 rounded-3xl p-6 relative overflow-hidden">
                            <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-gold/5" />
                            <Trophy className="w-8 h-8 text-gold mb-4" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gold/60">Top Performer</h4>
                            <p className="text-lg font-black text-white/90 mt-1">{team[0]?.name || "Ninguém"}</p>
                            <div className="mt-4 flex flex-col gap-1">
                                <span className="text-[10px] text-white/30 uppercase tracking-widest">Atendimentos</span>
                                <div className="h-1.5 w-full bg-white/5 rounded-full">
                                    <div className="h-full bg-gold rounded-full" style={{ width: '85%' }} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <Activity className="w-8 h-8 text-white/20 mb-4" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Atividade Geral</h4>
                            <p className="text-lg font-black text-white/80 mt-1">Alta</p>
                            <div className="mt-4 flex flex-col gap-3">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-white/30 italic">Respostas (24h)</span>
                                    <span className="text-white/60 font-mono">1.2k+</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-white/30 italic">Novos Contatos</span>
                                    <span className="text-white/60 font-mono">+142</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
