import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";

import type { TenantReadinessSnapshot } from "@/lib/onboarding-status";

type Props = {
    slug: string;
    readiness: TenantReadinessSnapshot;
    compact?: boolean;
};

export function TenantReadinessBanner({ slug, readiness, compact = false }: Props) {
    if (readiness.ready) {
        return (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                    <div className="space-y-1">
                        <p className="font-semibold">Tenant pronto para go-live</p>
                        <p className="text-emerald-50/80">
                            Email conectado, pipeline configurada e base minima operacional ja estao prontos.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm ${compact ? "" : "space-y-3"}`}>
            <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                <div className="space-y-1">
                    <p className="font-semibold text-amber-50">Go-live parcial bloqueado</p>
                    <p className="text-amber-50/80">
                        Falta completar o minimo operacional antes de ativar o tenant em producao.
                    </p>
                </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
                {readiness.blockers.map((blocker) => (
                    <div key={blocker.id} className="flex items-start gap-2 rounded-xl border border-amber-300/10 bg-black/10 px-3 py-2 text-amber-50/90">
                        <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" />
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em]">{blocker.label}</p>
                            <p className="text-xs leading-5 text-amber-50/70">{blocker.detail}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-amber-50/80">
                <span>
                    {readiness.completedStepCount}/{readiness.totalStepCount} passos concluídos
                </span>
                <Link href={`/org/${slug}/admin/workspaces`} className="font-semibold text-amber-50 underline-offset-4 hover:underline">
                    Revisar checklist
                </Link>
            </div>
        </div>
    );
}
