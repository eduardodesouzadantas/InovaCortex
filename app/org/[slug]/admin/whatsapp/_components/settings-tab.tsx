"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
    Bell,
    CheckCircle2,
    ExternalLink,
    Key,
    Loader2,
    Save,
    ShieldCheck,
    Smartphone,
} from "lucide-react";

type SettingItem = {
    key: string;
    masked?: string;
    configured?: boolean;
};

const META_FIELDS = [
    { key: "META_WABA_ID", label: "ID da Conta do WhatsApp Business (WABA_ID)", type: "text" },
    { key: "META_PHONE_NUMBER_ID", label: "ID do Telefone (Phone Number ID)", type: "text" },
    { key: "META_ACCESS_TOKEN", label: "Token de Acesso (Access Token Permanente)", type: "password" },
    { key: "META_VERIFY_TOKEN", label: "Token de Verificação do Webhook", type: "text" },
] as const;

type FieldKey = typeof META_FIELDS[number]["key"];

function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}

export function SettingsTab({ slug: providedSlug }: { slug?: string }) {
    const params = useParams();
    const slug = providedSlug ?? (params.slug as string);

    const [activeSubtab, setActiveSubtab] = useState("api");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [feedback, setFeedback] = useState<string | null>(null);
    const [configuredMap, setConfiguredMap] = useState<Record<string, SettingItem>>({});
    const [values, setValues] = useState<Record<FieldKey, string>>({
        META_WABA_ID: "",
        META_PHONE_NUMBER_ID: "",
        META_ACCESS_TOKEN: "",
        META_VERIFY_TOKEN: "",
    });

    async function fetchConfig() {
        setLoading(true);
        setFeedback(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(slug)}/whatsapp/config/meta`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Falha ao carregar configurações");

            const map: Record<string, SettingItem> = {};
            for (const item of (data.settings || []) as SettingItem[]) {
                map[item.key] = item;
            }
            setConfiguredMap(map);
        } catch (err: unknown) {
            setFeedback(getErrorMessage(err, "Erro ao carregar configurações"));
            setStatus("error");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    const webhookUrl = useMemo(() => {
        if (typeof window === "undefined") return `/api/webhooks/meta`;
        return `${window.location.origin}/api/webhooks/meta`;
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setStatus("idle");
        setFeedback(null);
        try {
            const changedEntries = META_FIELDS
                .map((field) => ({ key: field.key, value: values[field.key].trim() }))
                .filter((item) => item.value.length > 0);

            if (changedEntries.length === 0) {
                setFeedback("Nenhuma alteração informada. Preencha os campos que deseja atualizar.");
                setStatus("error");
                return;
            }

            const res = await fetch(`/api/org/${encodeURIComponent(slug)}/whatsapp/config/meta`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(changedEntries),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Falha ao salvar configurações");

            setValues({
                META_WABA_ID: "",
                META_PHONE_NUMBER_ID: "",
                META_ACCESS_TOKEN: "",
                META_VERIFY_TOKEN: "",
            });
            await fetchConfig();
            setStatus("success");
            setFeedback("Configurações salvas com sucesso.");
        } catch (err: unknown) {
            setStatus("error");
            setFeedback(getErrorMessage(err, "Falha ao salvar configurações"));
        } finally {
            setSaving(false);
        }
    };

    const sections = [
        { id: "api", label: "Conexão Meta", icon: Key },
        { id: "compliance", label: "Privacidade & LGPD", icon: ShieldCheck },
        { id: "notifications", label: "Notificações", icon: Bell },
    ];

    return (
        <div className="flex h-full overflow-hidden">
            <aside className="w-64 border-r border-white/5 bg-black/10 p-6 flex flex-col gap-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4 px-2">Configurações</h3>
                {sections.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSubtab(s.id)}
                        className={`
              flex items-center gap-3 p-3 rounded-xl transition-all text-xs font-bold uppercase tracking-widest
              ${activeSubtab === s.id ? "bg-gold text-black shadow-lg shadow-gold/10" : "text-white/40 hover:text-white/60 hover:bg-white/5"}
            `}
                    >
                        <s.icon className="w-4 h-4" />
                        {s.label}
                    </button>
                ))}
            </aside>

            <main className="flex-1 p-10 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-gold/50" />
                    </div>
                ) : (
                    <>
                        {activeSubtab === "api" && (
                            <div className="max-w-3xl flex flex-col gap-8 animate-in fade-in slide-in-from-right-4">
                                <section>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-2xl bg-gold/10 flex items-center justify-center text-gold">
                                            <Smartphone className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white/90">WhatsApp Cloud API</h2>
                                            <p className="text-sm text-white/40">Atualize credenciais do Meta para esta organização.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        {META_FIELDS.map((field) => {
                                            const current = configuredMap[field.key];
                                            return (
                                                <div key={field.key} className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">
                                                        {field.label}
                                                    </label>
                                                    <input
                                                        type={field.type}
                                                        value={values[field.key]}
                                                        onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                                        placeholder={current?.masked || `Informe ${field.key}`}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 focus:outline-none focus:border-gold/40 transition-all font-mono"
                                                    />
                                                    <div className="text-[10px] text-white/40 uppercase tracking-widest">
                                                        {current?.configured ? "Configurado" : "Não configurado"}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-6 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                                        <h4 className="text-sm font-bold text-blue-400">Webhook Endpoint</h4>
                                        <p className="text-xs text-white/40 mt-1 leading-relaxed">
                                            Configure esta URL no painel Meta para recebimento de eventos.
                                        </p>
                                        <code className="block mt-3 text-[11px] text-blue-300 break-all">{webhookUrl}</code>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeSubtab === "compliance" && (
                            <div className="max-w-2xl flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
                                <h2 className="text-xl font-bold text-white/90">Regras de Compliance</h2>
                                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 text-sm text-white/60">
                                    Janela de 24h e bloqueio de envio livre fora de sessão já são aplicados no backend de envio.
                                </div>
                                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 text-sm text-white/60">
                                    Mensagens fora da janela exigem template aprovado, conforme política do Meta.
                                </div>
                            </div>
                        )}

                        {activeSubtab === "notifications" && (
                            <div className="max-w-2xl flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
                                <h2 className="text-xl font-bold text-white/90">Notificações Operacionais</h2>
                                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 text-sm text-white/60">
                                    Alertas de erros de envio e eventos de conversa seguem o pipeline de logs/monitoramento do backend.
                                </div>
                            </div>
                        )}

                        <div className="mt-12 flex items-center justify-between pt-10 border-t border-white/5">
                            <a
                                href="https://developers.facebook.com/docs/whatsapp"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white/60"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Documentação Meta
                            </a>
                            {activeSubtab === "api" && (
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-8 py-3 bg-gold text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gold/90 transition-all shadow-lg shadow-gold/20 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : status === "success" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                    {saving ? "Salvando..." : status === "success" ? "Configurações Salvas" : "Salvar Alterações"}
                                </button>
                            )}
                        </div>

                        {feedback && (
                            <div className={`mt-4 rounded-xl border px-3 py-2 text-xs ${status === "success" ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
                                {feedback}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
