"use client";

import { useState } from "react";
import type { AgencySuccessPlaybook, AgencySuccessPlaybookExecution } from "@/lib/agency/surface-overview";

export async function postAgencyPlaybookStatus(payload: {
    playbookId: string;
    action: "suggested" | "in-progress" | "blocked" | "completed";
    owner?: string;
    observedImpact?: string | null;
}): Promise<{ success: true; data: AgencySuccessPlaybookExecution }> {
    const response = await fetch("/api/agency/playbooks/status", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Playbook status update failed: ${response.status} ${error?.error ?? "unknown"}`);
    }

    return response.json();
}

export function AgencyPlaybookStatusActions({
    playbook,
    onSuccess,
}: {
    playbook: AgencySuccessPlaybook;
    onSuccess?: (updated: AgencySuccessPlaybook) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleAction(
        event: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
        action: "in-progress" | "completed" | "blocked",
    ) {
        event.preventDefault();

        setLoading(true);
        setError(null);

        try {
            const result = await postAgencyPlaybookStatus({
                playbookId: playbook.id,
                action,
                owner: playbook.owner,
                observedImpact: playbook.observedImpact ?? null,
            });

            if (onSuccess) {
                onSuccess({ ...playbook, ...result.data });
            }
            setLoading(false);
        } catch (err) {
            setLoading(false);
            setError("Falha ao atualizar status do playbook. Tente novamente.");
            console.error("Error updating playbook status", err);
        }
    }

    const owner = playbook.owner ?? "agency";
    const baseHref = `/api/agency/playbooks/status?playbookId=${encodeURIComponent(playbook.id)}&owner=${encodeURIComponent(owner)}`;

    return (
        <div>
            <div className="mt-2 grid grid-cols-3 gap-2">
                <a
                    href={`${baseHref}&action=in-progress`}
                    data-action="in-progress"
                    onClick={(event) => void handleAction(event, "in-progress")}
                    aria-disabled={loading}
                    className={`rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-200 ${loading ? "opacity-50 pointer-events-none" : "hover:bg-white/[0.08]"}`}
                >
                    {loading ? "Atualizando..." : "Marcar em andamento"}
                </a>
                <a
                    href={`${baseHref}&action=completed`}
                    data-action="completed"
                    onClick={(event) => void handleAction(event, "completed")}
                    aria-disabled={loading}
                    className={`rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-200 ${loading ? "opacity-50 pointer-events-none" : "hover:bg-white/[0.08]"}`}
                >
                    {loading ? "Atualizando..." : "Marcar concluído"}
                </a>
                <a
                    href={`${baseHref}&action=blocked`}
                    data-action="blocked"
                    onClick={(event) => void handleAction(event, "blocked")}
                    aria-disabled={loading}
                    className={`rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-200 ${loading ? "opacity-50 pointer-events-none" : "hover:bg-white/[0.08]"}`}
                >
                    {loading ? "Atualizando..." : "Marcar bloqueado"}
                </a>
            </div>
            {error && <p className="mt-1 text-[10px] text-rose-300">{error}</p>}
        </div>
    );
}
