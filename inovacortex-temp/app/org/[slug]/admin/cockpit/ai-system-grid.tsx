"use client";

import { useState } from "react";
import { Wifi, WifiOff, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";

interface AISystem {
    key: string;
    label: string;
    route: string;
    enabled: boolean;
    callsToday: number;
    costMonth: number;
    successRate: number;
}

export function AISystemGrid({
    systems,
    orgSlug,
    isAdmin,
    stubKeys = {}
}: {
    systems: AISystem[];
    orgSlug: string;
    isAdmin: boolean;
    stubKeys?: Record<string, boolean>;
}) {
    const [states, setStates] = useState<Record<string, boolean>>(
        Object.fromEntries(systems.map(s => [s.key, s.enabled]))
    );
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const toggle = async (key: string, current: boolean) => {
        if (!isAdmin) return;
        setLoading(key);
        setError(null);
        try {
            const res = await fetch("/api/admin/cockpit/toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, enabled: !current }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Erro");
            setStates(prev => ({ ...prev, [key]: !current }));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {systems.map(sys => {
                    const isEnabled = states[sys.key];
                    const isLoading = loading === sys.key;
                    const isStub = stubKeys[sys.key];

                    return (
                        <div key={sys.key}
                            className={`relative rounded-xl border p-4 transition-all overflow-hidden ${isEnabled
                                ? "border-primary/30 bg-primary/5"
                                : "border-white/5 bg-white/2 opacity-60"
                                }`}>
                            {/* Stub mode banner */}
                            {isStub && (
                                <div className="absolute top-0 left-0 right-0 bg-yellow-500/20 text-[9px] uppercase tracking-widest text-center text-yellow-400 font-bold py-0.5 pointer-events-none">
                                    Stub Mode (No Token)
                                </div>
                            )}

                            {/* Status badge */}
                            <div className="flex items-center justify-between mb-3 mt-1.5">
                                <div className={`flex items-center gap-1.5 text-xs font-medium z-10 ${isEnabled ? "text-green-400" : "text-gray-500"}`}>
                                    {isEnabled
                                        ? <Wifi className="w-3.5 h-3.5" />
                                        : <WifiOff className="w-3.5 h-3.5" />
                                    }
                                    {isEnabled ? "Online" : "Offline"}
                                </div>

                                {/* Toggle */}
                                {isAdmin && (
                                    <button
                                        onClick={() => toggle(sys.key, isEnabled)}
                                        disabled={isLoading}
                                        className={`relative w-9 h-5 rounded-full z-10 transition-colors ${isEnabled ? "bg-primary/70" : "bg-white/10"}`}
                                    >
                                        {isLoading
                                            ? <Loader2 className="w-3 h-3 animate-spin absolute top-1 left-1 text-white" />
                                            : <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                                        }
                                    </button>
                                )}
                            </div>

                            <p className="font-bold text-sm mb-3 relative z-10">{sys.label}</p>

                            <div className="space-y-1.5 text-xs text-muted-foreground relative z-10">
                                <div className="flex justify-between">
                                    <span>Calls hoje</span>
                                    <span className="font-medium text-white">{sys.callsToday}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Custo / mês</span>
                                    <span className="font-medium text-yellow-400">${sys.costMonth.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Taxa sucesso</span>
                                    <span className="font-medium text-green-400">{sys.successRate}%</span>
                                </div>
                            </div>

                            <Link href={`/org/${orgSlug}/admin/${sys.route}`}
                                className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-white mt-3 transition-colors relative z-10">
                                Abrir <ExternalLink className="w-3 h-3" />
                            </Link>
                        </div>
                    );
                })}
            </div>

            {error && (
                <p className="text-xs text-red-400 mt-2">{error}</p>
            )}
        </div>
    );
}
