"use client";

import { useState } from "react";
import { Save, Loader2 } from "lucide-react";

interface InternalNotesProps {
    leadId: string;
    initialNotes: string | null;
    apiBasePath?: string;
}

export function InternalNotesEditor({ leadId, initialNotes, apiBasePath = "/api/admin/leads" }: InternalNotesProps) {
    const [notes, setNotes] = useState(initialNotes || "");
    const [isSaving, setIsSaving] = useState(false);
    const [savedStatus, setSavedStatus] = useState<"idle" | "saved" | "error">("idle");

    const handleSave = async () => {
        setIsSaving(true);
        setSavedStatus("idle");

        try {
            const res = await fetch(`${apiBasePath}/${leadId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ internalNotes: notes })
            });

            if (!res.ok) throw new Error("Falha ao salvar");

            setSavedStatus("saved");
            setTimeout(() => setSavedStatus("idle"), 3000);
        } catch (error) {
            console.error("Save Note Error", error);
            setSavedStatus("error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="glass-panel p-6 rounded-xl border border-border/50 h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Notas Internas & Checklist</h3>

                <button
                    onClick={handleSave}
                    disabled={isSaving || notes === initialNotes && savedStatus === "idle"}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-2"
                >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Salvar
                </button>
            </div>

            <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Exemplo de Checklist de Qualificação:&#10;[ ] Tem perfil decisor&#10;[ ] Confirmou a dor inicial na call&#10;[ ] Verba mapeada&#10;&#10;Registre as informações discutidas com o consultor aqui..."
                className="flex-1 w-full bg-muted/20 border border-border/50 rounded-lg p-4 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors"
            />

            {savedStatus === "saved" && (
                <p className="text-green-500 text-xs text-right mt-2 animate-pulse">✓ Alterações salvas com sucesso</p>
            )}
            {savedStatus === "error" && (
                <p className="text-red-500 text-xs text-right mt-2">✗ Erro ao salvar notas</p>
            )}
        </div>
    );
}
