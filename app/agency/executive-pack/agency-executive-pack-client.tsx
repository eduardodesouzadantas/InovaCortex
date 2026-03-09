"use client";

import { useState } from "react";

export function AgencyExecutivePackClient({ defaultOrgId }: { defaultOrgId: string }) {
    const [orgId, setOrgId] = useState(defaultOrgId);
    const [anonymized, setAnonymized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ id: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const response = await fetch("/api/agency/executive-pack/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId, anonymized }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? "Generation failed");
            setResult({ id: data.id });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Generation failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="space-y-2">
                <label className="block text-xs text-slate-400">Organization Id</label>
                <input
                    value={orgId}
                    onChange={(event) => setOrgId(event.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={anonymized} onChange={(event) => setAnonymized(event.target.checked)} />
                Anonymized
            </label>

            <button
                onClick={handleGenerate}
                disabled={loading}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
                {loading ? "Generating..." : "Generate Executive Pack"}
            </button>

            {result && (
                <p className="text-xs text-emerald-300">
                    Generated: <a className="underline" href={`/api/agency/executive-pack/${result.id}`} target="_blank" rel="noreferrer">{result.id}</a>
                </p>
            )}
            {error && <p className="text-xs text-rose-300">{error}</p>}
        </div>
    );
}
