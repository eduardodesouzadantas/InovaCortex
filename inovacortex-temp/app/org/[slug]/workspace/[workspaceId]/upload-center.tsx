"use client";

import { useState, useRef, useCallback } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, Image, Key, Type, Package } from "lucide-react";

type UploadType = "logo" | "brand" | "copy" | "credentials" | "other";

interface ExistingUpload {
    id: string;
    filename: string;
    type: string;
    url: string;
    createdAt: string;
}

interface Props {
    workspaceId: string;
    token: string;
    existingUploads: ExistingUpload[];
}

const TYPE_CONFIG: Record<UploadType, { label: string; Icon: any; desc: string }> = {
    logo: { label: "Logo", Icon: Image, desc: "Logotipo em PNG ou SVG" },
    brand: { label: "Identidade", Icon: Package, desc: "Manual de marca, cores e fontes" },
    copy: { label: "Textos", Icon: Type, desc: "Copies, scripts, FAQ etc." },
    credentials: { label: "Credenciais", Icon: Key, desc: "Tokens, acessos (criptografado)" },
    other: { label: "Outro", Icon: FileText, desc: "Qualquer arquivo relevante" },
};

export function UploadCenter({ workspaceId, token, existingUploads }: Props) {
    const [uploads, setUploads] = useState<ExistingUpload[]>(existingUploads);
    const [selectedType, setSelectedType] = useState<UploadType>("logo");
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleUpload = useCallback(async (file: File) => {
        setUploading(true);
        setError(null);
        const form = new FormData();
        form.append("file", file);
        form.append("type", selectedType);

        try {
            const res = await fetch(
                `/api/public/workspace/${workspaceId}/upload?t=${encodeURIComponent(token)}`,
                { method: "POST", body: form }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Erro no envio.");
            setUploads(prev => [{ id: data.id, filename: data.filename, type: selectedType, url: data.url, createdAt: new Date().toISOString() }, ...prev]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    }, [workspaceId, token, selectedType]);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
    }, [handleUpload]);

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
        e.target.value = "";
    };

    return (
        <div className="space-y-5">
            {/* Type selector */}
            <div className="flex flex-wrap gap-2">
                {(Object.entries(TYPE_CONFIG) as [UploadType, any][]).map(([key, cfg]) => {
                    const { Icon } = cfg;
                    return (
                        <button
                            key={key}
                            onClick={() => setSelectedType(key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedType === key
                                    ? "border-primary/60 bg-primary/10 text-primary"
                                    : "border-border/50 text-muted-foreground hover:border-primary/30"
                                }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {cfg.label}
                        </button>
                    );
                })}
            </div>

            {/* Drop zone */}
            <div
                onDragEnter={e => { e.preventDefault(); setDragging(true); }}
                onDragOver={e => e.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && inputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none
                    ${dragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-border/40 hover:border-primary/40 hover:bg-muted/20"}`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    onChange={onFileSelect}
                    accept="image/*,.pdf,.zip,.txt,.csv,.doc,.docx,.xls,.xlsx,.json"
                />
                {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Enviando arquivo…</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <UploadCloud className={`w-8 h-8 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
                        <div>
                            <p className="font-semibold text-sm">
                                {TYPE_CONFIG[selectedType].desc}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Arraste aqui ou clique para selecionar · Max 10 MB
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* Uploaded files list */}
            {uploads.length > 0 && (
                <div className="glass-panel rounded-xl border border-border/40 divide-y divide-border/30 overflow-hidden">
                    <p className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                        Arquivos Enviados ({uploads.length})
                    </p>
                    {uploads.map(u => {
                        const cfg = TYPE_CONFIG[u.type as UploadType] ?? TYPE_CONFIG.other;
                        const { Icon } = cfg;
                        return (
                            <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{u.filename}</p>
                                    <p className="text-xs text-muted-foreground">{cfg.label} · {new Date(u.createdAt).toLocaleDateString("pt-BR")}</p>
                                </div>
                                <a
                                    href={u.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline shrink-0"
                                >
                                    Ver
                                </a>
                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
