"use client";

import { AlertTriangle, X, Zap } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

interface Alert {
    id: string;
    type: string;
    severity: string;
    message: string;
}

const SEVERITY_COLORS: Record<string, string> = {
    critical: "bg-red-500/15    border-red-500/40    text-red-300",
    warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
    info: "bg-blue-500/10   border-blue-500/30   text-blue-300",
};

export function UsageAlertBanner({
    alerts,
    orgSlug,
}: {
    alerts: Alert[];
    orgSlug: string;
}) {
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    const visible = alerts.filter(a => !dismissed.has(a.id));
    if (visible.length === 0) return null;

    return (
        <div className="space-y-2 mb-4">
            {visible.map(alert => {
                const colorClass = SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.info;
                const Icon = alert.type === "usageThreshold" ? Zap : AlertTriangle;

                return (
                    <div key={alert.id}
                        className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${colorClass} text-sm`}
                    >
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="flex-1">
                            <strong className="capitalize">{alert.type.replace(/([A-Z])/g, " $1")}: </strong>
                            {alert.message}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                            <Link href={`/org/${orgSlug}/admin/billing`}
                                className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100">
                                Ver billing
                            </Link>
                            <button
                                onClick={() => setDismissed(prev => new Set(prev).add(alert.id))}
                                className="opacity-60 hover:opacity-100"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
