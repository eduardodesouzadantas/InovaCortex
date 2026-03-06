"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function AuditExportButton({
    orgSlug,
    filters,
}: {
    orgSlug: string;
    filters: { type?: string; from?: string; to?: string };
}) {
    const [isLoading, setIsLoading] = useState(false);

    const handleExport = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ orgSlug, ...filters as any });
            const res = await fetch(`/api/admin/audit/export?${params}`);
            if (!res.ok) throw new Error("Export failed");

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit-${orgSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert("Erro ao exportar. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={isLoading}
            title="Exportar CSV"
            className="btn-secondary h-9 px-3 flex items-center gap-1.5 text-sm"
        >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            CSV
        </button>
    );
}
