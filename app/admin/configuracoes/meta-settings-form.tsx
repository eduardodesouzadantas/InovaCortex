"use client";

import { useState } from "react";
import { Save, Loader2, Eye, EyeOff, Database, Server } from "lucide-react";

interface SettingField {
    key: string;
    label: string;
    type: string;
    value: string;
    fromDb: boolean;
    fromEnv: boolean;
}

export function MetaSettingsForm({
    initialValues,
    orgSlug,
}: {
    initialValues: SettingField[];
    orgSlug?: string;
}) {
    const [values, setValues] = useState<Record<string, string>>(
        Object.fromEntries(initialValues.map(s => [s.key, s.value]))
    );
    const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

    const handleChange = (key: string, value: string) => {
        setValues(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus("idle");
        try {
            const endpoint = orgSlug
                ? `/api/org/${encodeURIComponent(orgSlug)}/whatsapp/config/meta`
                : "/api/admin/config";
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    Object.entries(values).map(([key, value]) => ({ key, value }))
                )
            });
            if (!res.ok) throw new Error("Falha ao salvar");
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch {
            setSaveStatus("error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-border/50 flex justify-between items-center">
                <h3 className="font-bold text-lg">Credenciais Meta / WhatsApp Cloud API</h3>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn-primary flex items-center gap-2 text-sm"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? "Salvando..." : "Salvar Configurações"}
                </button>
            </div>

            {saveStatus === "success" && (
                <div className="mx-6 mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm font-medium">
                    ✓ Configurações salvas com sucesso no banco de dados
                </div>
            )}
            {saveStatus === "error" && (
                <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium">
                    ✗ Erro ao salvar configurações
                </div>
            )}

            <div className="p-6 space-y-5">
                {initialValues.map((field) => (
                    <div key={field.key}>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm font-semibold text-foreground">
                                {field.label}
                            </label>
                            <div className="flex items-center gap-2">
                                {field.fromDb && (
                                    <span className="flex items-center gap-1 text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                        <Database className="w-2.5 h-2.5" /> Salvo no BD
                                    </span>
                                )}
                                {field.fromEnv && (
                                    <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
                                        <Server className="w-2.5 h-2.5" /> Do .env
                                    </span>
                                )}
                                {!field.fromDb && !field.fromEnv && (
                                    <span className="text-[10px] text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                        Não configurado
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="relative">
                            <input
                                type={field.type === "password" && !showPassword[field.key] ? "password" : "text"}
                                value={values[field.key]}
                                onChange={(e) => handleChange(field.key, e.target.value)}
                                placeholder={`Cole aqui o valor de ${field.key}`}
                                className="w-full bg-muted/20 border border-border/50 rounded-lg px-4 py-3 pr-10 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
                            />
                            {field.type === "password" && (
                                <button
                                    onClick={() => setShowPassword(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    type="button"
                                >
                                    {showPassword[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{field.key}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
