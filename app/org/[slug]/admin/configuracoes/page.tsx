import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CheckCircle2, ShieldAlert, Settings, ChevronLeft } from "lucide-react";
import { MetaSettingsForm } from "@/app/admin/configuracoes/meta-settings-form";

export const runtime = "nodejs";

const SETTINGS_KEYS = [
    { key: "META_WABA_ID", label: "ID da Conta do WhatsApp Business (WABA_ID)", type: "text" },
    { key: "META_PHONE_NUMBER_ID", label: "ID do Telefone (Phone Number ID)", type: "text" },
    { key: "META_ACCESS_TOKEN", label: "Token de Acesso (Access Token Permanente)", type: "password" },
    { key: "META_VERIFY_TOKEN", label: "Token de Validação do Webhook (Verify Token)", type: "text" },
];

export default async function OrgConfiguracoesPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    let ctx: Awaited<ReturnType<typeof requireOrgContext>>;
    try {
        ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "admin");
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    // Load saved values from DB (scoped to this org)
    const savedSettings = await (prisma as any).systemSetting.findMany({
        where: {
            organizationId: ctx!.orgId,
            key: { in: SETTINGS_KEYS.map(s => s.key) },
        }
    });

    const settingsMap: Record<string, string> = {};
    savedSettings.forEach((s: any) => { settingsMap[s.key] = s.value; });

    const envMap: Record<string, string | undefined> = {
        META_WABA_ID: process.env.META_WABA_ID,
        META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID,
        META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
        META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
    };

    const currentValues = SETTINGS_KEYS.map(s => ({
        ...s,
        value: settingsMap[s.key] || envMap[s.key] || "",
        fromDb: !!settingsMap[s.key],
        fromEnv: !settingsMap[s.key] && !!envMap[s.key],
    }));

    const isFullyConfigured = currentValues.every(s => !!s.value);

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            Configurações
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">Integração WhatsApp Cloud API (Meta)</p>
                    </div>
                </div>

                {/* Status Banner */}
                <div className={`p-4 rounded-xl flex items-start gap-3 border ${isFullyConfigured
                        ? "bg-green-500/10 border-green-500/20 text-green-400"
                        : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                    }`}>
                    {isFullyConfigured
                        ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                        : <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                    }
                    <div>
                        <p className="font-bold text-sm">
                            {isFullyConfigured ? "Integração ativa e pronta" : "Configuração incompleta"}
                        </p>
                        <p className="text-xs opacity-80 mt-0.5">
                            {isFullyConfigured
                                ? "Todas as credenciais configuradas. Disparo automático via WhatsApp habilitado."
                                : "Preencha os campos abaixo e clique em Salvar para ativar o WhatsApp."}
                        </p>
                    </div>
                </div>

                {/* Reuse the existing form component */}
                <MetaSettingsForm initialValues={currentValues} orgSlug={slug} />

                {/* AI Keys info */}
                <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-xs text-muted-foreground space-y-2">
                    <p><strong className="text-white">Prioridade:</strong> Valores salvos aqui têm prioridade sobre variáveis do <code className="bg-white/10 px-1 rounded">.env</code>. Útil para atualizar tokens sem re-deploy.</p>
                    <p><strong className="text-white">OPENAI_API_KEY:</strong> Para o Agente de Pré-Vendas e Content Engine, adicione diretamente no <code className="bg-white/10 px-1 rounded">.env</code>: <code className="bg-white/10 px-1 rounded">OPENAI_API_KEY=sk-...</code></p>
                </div>

            </div>
        </div>
    );
}
