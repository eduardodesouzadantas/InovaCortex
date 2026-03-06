"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Clock, ArrowRight } from "lucide-react";

interface Alert {
    id: string;
    title: string;
    description: string;
    severity: "high" | "critical" | "warning";
    timestamp: string;
}

// Mocking some live alerts for the UI since the engine runs backend anomaly sweeps
const MOCK_ALERTS: Alert[] = [
    {
        id: "a1",
        title: "14 leads sem resposta",
        description: "Mais de 48h sem contato. Risco de perda alta.",
        severity: "critical",
        timestamp: "Há 2h",
    },
    {
        id: "a2",
        title: "Proposta Estagnada",
        description: "Alves Advisory enviada há 5 dias sem resposta.",
        severity: "high",
        timestamp: "Há 5h",
    },
    {
        id: "a3",
        title: "Orçamento de IA Excedido",
        description: "Plano Planner atingiu 90% do limite mensal.",
        severity: "warning",
        timestamp: "Há 1d",
    }
];

export function CeoAlerts() {
    const getSeverityStyle = (severity: string) => {
        switch (severity) {
            case "critical": return "bg-rose-500/10 border-rose-500/20 text-rose-400";
            case "high": return "bg-orange-500/10 border-orange-500/20 text-orange-400";
            default: return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
        }
    };

    return (
        <div className="bg-zinc-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    Profit Leaks & Alertas
                </h3>
            </div>

            <div className="flex-1 space-y-3">
                {MOCK_ALERTS.map((alert, i) => (
                    <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`p-4 rounded-xl border flex items-start gap-4 ${getSeverityStyle(alert.severity)}`}
                    >
                        <div className="mt-0.5">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-white truncate">{alert.title}</h4>
                            <p className="text-xs text-white/70 mt-1 line-clamp-2">{alert.description}</p>

                            <div className="flex items-center gap-4 mt-3">
                                <span className="text-[10px] uppercase font-medium flex items-center gap-1 opacity-60">
                                    <Clock className="w-3 h-3" />
                                    {alert.timestamp}
                                </span>
                                <button className="text-[10px] uppercase font-bold text-white hover:text-white/80 transition-colors flex items-center gap-1 ml-auto">
                                    Resolver <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
