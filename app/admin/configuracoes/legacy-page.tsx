import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ShieldAlert, Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MetaSettingsForm } from "./meta-settings-form";

export const runtime = "nodejs";

const SETTINGS_KEYS = [
    { key: "META_WABA_ID", label: "ID da Conta do WhatsApp Business (WABA_ID)", type: "text" },
    { key: "META_PHONE_NUMBER_ID", label: "ID do Telefone (Phone Number ID)", type: "text" },
    { key: "META_ACCESS_TOKEN", label: "Token de Acesso (Access Token Permanente)", type: "password" },
    { key: "META_VERIFY_TOKEN", label: "Token de Validação do Webhook (Verify Token)", type: "text" },
];

export default async function ConfiguracoesPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token");

    if (!token || token.value !== "authenticated_true") {
        redirect("/admin/login");
    }

    // Load saved values from DB
    const savedSettings = await prisma.systemSetting.findMany({
        where: { key: { in: SETTINGS_KEYS.map((s) => s.key) } }
    });

    const settingsMap: Record<string, string> = {};
    savedSettings.forEach((s) => { settingsMap[s.key] = s.value; });

    // Also check ENV for fallback
    const envMap: Record<string, string | undefined> = {
        META_WABA_ID: process.env.META_WABA_ID,
        META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID,
        META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
        META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
    };

    const currentValues = SETTINGS_KEYS.map((s) => ({
        ...s,
        value: settingsMap[s.key] || envMap[s.key] || "",
        fromDb: !!settingsMap[s.key],
        fromEnv: !settingsMap[s.key] && !!envMap[s.key],
    }));

    const isFullyConfigured = currentValues.every((s) => !!s.value);

    return (
        <div className="min-h-screen bg-muted/10 p-8 pt-32">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-3">
                            <Link href="/admin" className="text-muted-foreground hover:text-foreground">Mission Control</Link>
                            <span className="text-muted-foreground">/</span>
                            Configurações Meta
                        </h1>
                        <p className="text-muted-foreground mt-1">Integração WhatsApp Cloud API (V3)</p>
                    </div>
                    <Settings className="w-8 h-8 text-muted-foreground" />
                </div>

                {/* Status Banner */}
                <div className={`mb-8 p-4 rounded-xl flex items-start gap-3 border ${isFullyConfigured ? 'bg-green-500/10 border-green-500/20 text-green-600' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600'}`}>
                    {isFullyConfigured ? <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" /> : <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />}
                    <div>
                        <h3 className="font-bold text-lg">{isFullyConfigured ? 'Integração Ativa e Pronta' : 'Atenção: Configuração Incompleta'}</h3>
                        <p className="text-sm opacity-90">
                            {isFullyConfigured
                                ? 'Todas as credenciais foram configuradas. O envio automatizado de dossiês via WhatsApp está habilitado.'
                                : 'Preencha os campos abaixo e clique em Salvar para ativar o disparo automático de WhatsApp.'}
                        </p>
                    </div>
                </div>

                {/* Editable Form (Client Component) */}
                <MetaSettingsForm initialValues={currentValues} />

                {/* Info */}
                <div className="mt-6 bg-muted/30 p-4 rounded-xl text-sm text-muted-foreground border border-border/30">
                    <p><strong>Prioridade:</strong> Valores salvos aqui têm prioridade sobre as variáveis do arquivo <code>.env</code>. Use isso para atualizar tokens sem necessitar de re-deploy.</p>
                    <p className="mt-2"><strong>OPENAI_API_KEY:</strong> Para o Agente de Pré-Vendas (V5), adicione esta chave diretamente no arquivo <code>.env</code>: <code>OPENAI_API_KEY=sk-...</code></p>
                </div>
            </div>
        </div>
    );
}
