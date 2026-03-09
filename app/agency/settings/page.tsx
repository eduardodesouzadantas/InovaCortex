import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ShieldAlert, Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth/session";
import { AgencyMetaSettingsForm } from "./meta-settings-form";

export const runtime = "nodejs";

const SETTINGS_KEYS = [
    { key: "META_WABA_ID", label: "ID da Conta do WhatsApp Business (WABA_ID)", type: "text" },
    { key: "META_PHONE_NUMBER_ID", label: "ID do Telefone (Phone Number ID)", type: "text" },
    { key: "META_ACCESS_TOKEN", label: "Token de Acesso (Access Token Permanente)", type: "password" },
    { key: "META_VERIFY_TOKEN", label: "Token de Validacao do Webhook (Verify Token)", type: "text" },
] as const;

function isAgencyShellEnabled(): boolean {
    const raw = process.env.FF_AGENCY_SHELL;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export default async function AgencySettingsPage() {
    if (!isAgencyShellEnabled()) {
        redirect("/admin/configuracoes");
    }

    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency" || !auth.organizationId) {
        redirect("/agency/login");
    }

    const savedSettings = await prisma.systemSetting.findMany({
        where: {
            organizationId: auth.organizationId,
            key: { in: SETTINGS_KEYS.map((s) => s.key) },
        },
    });

    const settingsMap = new Map(savedSettings.map((s) => [s.key, s.value]));
    const envMap: Record<string, string | undefined> = {
        META_WABA_ID: process.env.META_WABA_ID,
        META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID,
        META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
        META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
    };

    const currentValues = SETTINGS_KEYS.map((s) => {
        const dbValue = settingsMap.get(s.key);
        const envValue = envMap[s.key];
        return {
            ...s,
            value: dbValue || envValue || "",
            fromDb: !!dbValue,
            fromEnv: !dbValue && !!envValue,
        };
    });

    const isFullyConfigured = currentValues.every((s) => !!s.value);

    return (
        <section className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
                        <Link href="/agency/dashboard" className="text-slate-400 hover:text-slate-100">
                            Agency
                        </Link>
                        <span className="text-slate-600">/</span>
                        Configuracoes
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">Integracao Meta / WhatsApp Cloud API (agency)</p>
                </div>
                <Settings className="h-6 w-6 text-slate-400" />
            </div>

            <div
                className={`flex items-start gap-3 rounded-xl border p-4 ${
                    isFullyConfigured
                        ? "border-green-500/30 bg-green-500/10 text-green-200"
                        : "border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
                }`}
            >
                {isFullyConfigured ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                    <h3 className="text-sm font-semibold">
                        {isFullyConfigured ? "Integracao ativa e pronta" : "Atencao: configuracao incompleta"}
                    </h3>
                    <p className="mt-1 text-xs opacity-90">
                        {isFullyConfigured
                            ? "Credenciais da agencia configuradas para operacao."
                            : "Preencha os campos e salve para habilitar operacao completa."}
                    </p>
                </div>
            </div>

            <AgencyMetaSettingsForm initialValues={currentValues} />

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-400">
                Endpoint canônico da agency:{" "}
                <code className="text-slate-200">/api/agency/settings/meta</code>.
            </div>
        </section>
    );
}
