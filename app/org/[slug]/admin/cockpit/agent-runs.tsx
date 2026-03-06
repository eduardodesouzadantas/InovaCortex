"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

export function AgentRuns({ runs }: { runs: any[] }) {
    if (runs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-6 text-center border border-white/5 rounded-xl bg-white/5">
                <p className="text-sm font-medium">Nenhuma execução registrada</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-white/5">
                    <tr>
                        <th className="px-4 py-2 rounded-tl-lg">Agente</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Entity</th>
                        <th className="px-4 py-2">Custo</th>
                        <th className="px-4 py-2 rounded-tr-lg">Timing</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {runs.map(run => (
                        <tr key={run.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 font-semibold text-white/90">
                                {run.agentName}
                            </td>
                            <td className="px-4 py-3">
                                {run.status === "succeeded" && <span className="inline-flex items-center gap-1 text-green-400 bg-green-400/10 px-2 py-0.5 rounded-lg text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> OK</span>}
                                {run.status === "failed" && <span className="inline-flex items-center gap-1 text-red-400 bg-red-400/10 px-2 py-0.5 rounded-lg text-xs font-medium" title={run.errorMessage}><XCircle className="w-3 h-3" /> ERRO</span>}
                                {run.status === "running" && <span className="inline-flex items-center gap-1 text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-lg text-xs font-medium"><Clock className="w-3 h-3" /> RODANDO</span>}
                                {run.status === "queued" && <span className="inline-flex items-center gap-1 text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-lg text-xs font-medium"><Clock className="w-3 h-3" /> FILA</span>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                                {run.relatedEntityType} {run.relatedEntityId ? `(${run.relatedEntityId.slice(0, 6)})` : ""}
                            </td>
                            <td className="px-4 py-3 text-green-400/80 font-mono text-xs">
                                ${run.costUsd.toFixed(4)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-[10px]">
                                {run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : "N/A"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
