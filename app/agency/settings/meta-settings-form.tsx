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

export function AgencyMetaSettingsForm({
    initialValues,
}: {
    initialValues: SettingField[];
}) {
    const [values, setValues] = useState<Record<string, string>>(
        Object.fromEntries(initialValues.map((s) => [s.key, s.value])),
    );
    const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

    const handleChange = (key: string, value: string) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus("idle");
        try {
            const res = await fetch("/api/agency/settings/meta", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    Object.entries(values).map(([key, value]) => ({ key, value })),
                ),
            });
            if (!res.ok) throw new Error("save_failed");
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch {
            setSaveStatus("error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
                <h3 className="text-lg font-bold text-slate-100">Credenciais Meta / WhatsApp Cloud API</h3>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-md border border-cyan-700 bg-cyan-900/40 px-3 py-2 text-sm text-cyan-100 transition-colors hover:bg-cyan-800/50 disabled:opacity-60"
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isSaving ? "Salvando..." : "Salvar"}
                </button>
            </div>

            {saveStatus === "success" && (
                <div className="mx-6 mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm font-medium text-green-300">
                    Configuracoes salvas com sucesso.
                </div>
            )}
            {saveStatus === "error" && (
                <div className="mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-medium text-red-300">
                    Erro ao salvar configuracoes.
                </div>
            )}

            <div className="space-y-5 p-6">
                {initialValues.map((field) => (
                    <div key={field.key}>
                        <div className="mb-1.5 flex items-center justify-between">
                            <label className="text-sm font-semibold text-slate-100">{field.label}</label>
                            <div className="flex items-center gap-2">
                                {field.fromDb && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-300">
                                        <Database className="h-2.5 w-2.5" /> Salvo no BD
                                    </span>
                                )}
                                {field.fromEnv && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300">
                                        <Server className="h-2.5 w-2.5" /> Do env
                                    </span>
                                )}
                                {!field.fromDb && !field.fromEnv && (
                                    <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300">
                                        Nao configurado
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
                                className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-4 py-3 pr-10 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                            />
                            {field.type === "password" && (
                                <button
                                    onClick={() =>
                                        setShowPassword((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100"
                                    type="button"
                                >
                                    {showPassword[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            )}
                        </div>
                        <p className="mt-1 font-mono text-xs text-slate-500">{field.key}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
