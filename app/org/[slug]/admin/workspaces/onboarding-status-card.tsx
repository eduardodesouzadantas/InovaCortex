import Link from "next/link";
import type { OnboardingStatusSnapshot } from "@/lib/onboarding-status";
import { getTenantReadinessFromOnboarding } from "@/lib/onboarding-status";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { TenantReadinessBanner } from "@/components/go-live/tenant-readiness-banner";

type Props = {
    orgSlug: string;
    onboarding: OnboardingStatusSnapshot;
};

const STEP_LINKS: Record<string, { href: (orgSlug: string) => string; label: string }> = {
    email: {
        href: (orgSlug) => `/org/${orgSlug}/admin/email`,
        label: "Conectar email",
    },
    pipeline: {
        href: (orgSlug) => `/org/${orgSlug}/admin/crm`,
        label: "Configurar pipeline",
    },
    first_crm_record: {
        href: (orgSlug) => `/org/${orgSlug}/admin/deals`,
        label: "Criar primeiro deal",
    },
};

export function OnboardingStatusCard({ orgSlug, onboarding }: Props) {
    const readiness = getTenantReadinessFromOnboarding(onboarding);

    return (
        <section className="glass-panel rounded-3xl border border-border/50 p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Tenant onboarding</p>
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black">Checklist inicial</h2>
                        <span className="text-xs rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-muted-foreground">
                            {onboarding.progressPercent}% completo
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                        A leitura abaixo mostra apenas o progresso inicial do tenant. Email, pipeline e o primeiro contato/deal
                        avançam o onboarding, sem mudar a operacao normal do CRM.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Estado</p>
                    <p className="text-sm font-medium">
                        {onboarding.status === "completed" ? "Completo" : onboarding.status === "in_progress" ? "Em progresso" : "Nao iniciado"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {onboarding.completedStepCount}/{onboarding.totalStepCount} passos concluídos
                    </p>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                {onboarding.steps.map((step) => {
                    const done = step.status === "done";
                    return (
                        <div
                            key={step.id}
                            className={`rounded-2xl border p-4 transition-colors ${
                                done
                                    ? "border-emerald-500/30 bg-emerald-500/10"
                                    : "border-border/60 bg-background/30"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold">{step.label}</p>
                                    <p className="text-xs text-muted-foreground">{step.detail}</p>
                                </div>
                                {done ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                )}
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3">
                                <span className={`text-xs font-medium ${done ? "text-emerald-500" : "text-muted-foreground"}`}>
                                    {done ? "Concluido" : "Pendente"}
                                </span>
                                {STEP_LINKS[step.id] ? (
                                    <Link
                                        href={STEP_LINKS[step.id].href(orgSlug)}
                                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                        {done ? "Revisar" : STEP_LINKS[step.id].label}
                                        <ArrowRight className="h-3 w-3" />
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-2xl border border-border/50 bg-background/40 p-4 text-sm text-muted-foreground">
                O onboarding avanca de forma persistida por tenant. Se o email, a pipeline ou o primeiro contato/deal ja
                existem, o painel os reconhece e atualiza o estado sem criar fluxo paralelo.
            </div>

            <TenantReadinessBanner slug={orgSlug} readiness={readiness} compact />
        </section>
    );
}
