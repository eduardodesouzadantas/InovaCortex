"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export function CockpitActionsHandler() {
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    async function handleNudge() {
        setIsLoading(true);
        try {
            await fetch("/api/admin/workspaces/nudge", { method: "POST" });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2000);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <button
            onClick={handleNudge}
            disabled={isLoading || success}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-white bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/40 rounded-xl py-2 mt-2 transition-colors disabled:opacity-50"
        >
            {isLoading ? (
                <span className="w-3.5 h-3.5 border border-white/50 border-t-white rounded-full animate-spin" />
            ) : success ? (
                "Nudge global enviado!"
            ) : (
                <>
                    <Send className="w-3.5 h-3.5" /> Nudge Geral (Workspaces)
                </>
            )}
        </button>
    );
}
