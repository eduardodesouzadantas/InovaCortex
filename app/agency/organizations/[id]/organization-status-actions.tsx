"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";

type OrganizationLifecycleStatus = "active" | "suspended" | "onboarding";

export function OrganizationStatusActions({
    organizationId,
    organizationName,
    lifecycleStatus,
    canManage,
}: {
    organizationId: string;
    organizationName: string;
    lifecycleStatus: OrganizationLifecycleStatus;
    canManage: boolean;
}) {
    const action = useMemo(() => {
        if (lifecycleStatus === "suspended") {
            return {
                href: `/api/agency/organizations/${organizationId}/activate`,
                label: "Ativar organizacao",
                tone: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:border-emerald-400/30 hover:bg-emerald-400/15",
                confirmMessage: null as string | null,
            };
        }

        return {
            href: `/api/agency/organizations/${organizationId}/suspend`,
            label: "Suspender organizacao",
            tone: "border-rose-400/20 bg-rose-400/10 text-rose-100 hover:border-rose-400/30 hover:bg-rose-400/15",
            confirmMessage: `Suspender ${organizationName}? A empresa ficara sem acesso ate ser reativada.`,
        };
    }, [lifecycleStatus, organizationId, organizationName]);

    if (!canManage) {
        return null;
    }

    return (
        <div className="rounded-[26px] border border-white/8 bg-[#0a1624] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Controle basico
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <form
                    action={action.href}
                    method="post"
                    onSubmit={(event) => {
                        if (!action.confirmMessage) return;
                        const confirmed = window.confirm(action.confirmMessage);
                        if (!confirmed) {
                            event.preventDefault();
                        }
                    }}
                >
                    <button
                        type="submit"
                        className={cn(
                            "inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition",
                            action.tone,
                        )}
                    >
                        {action.label}
                    </button>
                </form>
                <p className="text-xs text-slate-400">
                    Acoes admin restritas ao escopo Agency.
                </p>
            </div>
        </div>
    );
}
