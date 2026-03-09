/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart2, Copy } from "lucide-react";
import { AuthorityGenerateButton } from "@/app/org/[slug]/admin/authority/generate-button";
import { AuthorityStatusActions } from "@/app/org/[slug]/admin/authority/status-actions";

type AuthorityAsset = {
    id: string;
    type: string;
    status: string;
    title: string;
    headline: string;
    body: string;
    keyMetrics: string;
    anonLevel: string;
    createdAt: string;
    publishedUrl?: string | null;
};

type ProofStat = {
    id: string;
    label: string;
    value: string;
    unit?: string | null;
};

function renderTypeLabel(value: string): string {
    return value.replace(/_/g, " ");
}

function renderAnonLabel(value: string): string {
    if (value === "full") return "full";
    if (value === "sector_only") return "sector_only";
    if (value === "size_only") return "size_only";
    if (value === "none") return "none";
    return value;
}

export function AgencyAuthorityClient({
    workspaces,
}: {
    workspaces: { id: string; companyName: string; status: string }[];
}) {
    const [assets, setAssets] = useState<AuthorityAsset[]>([]);
    const [stats, setStats] = useState<ProofStat[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();
    const [copied, setCopied] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [typeFilter, setTypeFilter] = useState<string>("");

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(undefined);
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.set("status", statusFilter);
            if (typeFilter) params.set("type", typeFilter);
            const res = await fetch(`/api/agency/authority${params.toString() ? `?${params.toString()}` : ""}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Falha ao carregar authority assets");
            setAssets(data.assets ?? []);
            setStats(data.stats ?? []);
        } catch (e: any) {
            setError(e.message ?? "Falha ao carregar dados");
        } finally {
            setLoading(false);
        }
    }, [statusFilter, typeFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const types = useMemo(() => {
        const uniqueTypes = new Set(assets.map((asset) => asset.type));
        return Array.from(uniqueTypes.values());
    }, [assets]);

    const statuses = ["internal", "anonymized", "approved", "published"];

    const copyText = (key: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black">Authority Library</h1>
                    <p className="text-sm text-muted-foreground">
                        Biblioteca canônica da agency consumindo <code>/api/agency/authority</code>
                    </p>
                </div>
                <AuthorityGenerateButton workspaces={workspaces} apiBasePath="/api/agency/authority" onGenerated={loadData} />
            </div>

            {stats.length > 0 && (
                <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <BarChart2 className="h-4 w-4" /> Proof Stats
                    </h2>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
                        {stats.map((stat) => (
                            <button
                                key={stat.id}
                                onClick={() => copyText(stat.id, `${stat.label}: ${stat.value}`)}
                                className="rounded-lg border border-border/40 bg-background/40 p-3 text-left hover:border-primary/30"
                            >
                                <p className="text-xs text-muted-foreground">{stat.label}</p>
                                <p className="text-sm font-semibold">{stat.value}</p>
                                <p className="mt-1 text-xs text-primary">{copied === stat.id ? "copiado" : "copiar"}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <button
                    onClick={() => setStatusFilter("")}
                    className={`rounded-full border px-3 py-1 text-xs ${statusFilter === "" ? "border-primary/40 bg-primary/20 text-primary" : "border-border/40 text-muted-foreground"}`}
                >
                    all
                </button>
                {statuses.map((status) => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`rounded-full border px-3 py-1 text-xs ${statusFilter === status ? "border-primary/40 bg-primary/20 text-primary" : "border-border/40 text-muted-foreground"}`}
                    >
                        {status}
                    </button>
                ))}
                <span className="ml-3 text-xs text-muted-foreground">Tipo:</span>
                <button
                    onClick={() => setTypeFilter("")}
                    className={`rounded-full border px-3 py-1 text-xs ${typeFilter === "" ? "border-primary/40 bg-primary/20 text-primary" : "border-border/40 text-muted-foreground"}`}
                >
                    all
                </button>
                {types.map((type) => (
                    <button
                        key={type}
                        onClick={() => setTypeFilter(type)}
                        className={`rounded-full border px-3 py-1 text-xs ${typeFilter === type ? "border-primary/40 bg-primary/20 text-primary" : "border-border/40 text-muted-foreground"}`}
                    >
                        {renderTypeLabel(type)}
                    </button>
                ))}
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

            <div className="space-y-3">
                {assets.length === 0 && !loading && (
                    <div className="rounded-xl border border-border/40 p-8 text-center text-sm text-muted-foreground">
                        Nenhum authority asset encontrado.
                    </div>
                )}

                {assets.map((asset) => {
                    const parsedMetrics = (() => {
                        try {
                            return JSON.parse(asset.keyMetrics ?? "{}");
                        } catch {
                            return {};
                        }
                    })();
                    return (
                        <div key={asset.id} className="rounded-xl border border-border/40 p-4">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-border/40 px-2 py-0.5 text-xs text-muted-foreground">
                                    {renderTypeLabel(asset.type)}
                                </span>
                                <span className="rounded-full border border-border/40 px-2 py-0.5 text-xs text-muted-foreground">
                                    {asset.status}
                                </span>
                                <span className="rounded-full border border-border/40 px-2 py-0.5 text-xs text-muted-foreground">
                                    anon: {renderAnonLabel(asset.anonLevel)}
                                </span>
                            </div>

                            <div className="mb-2 flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold">{asset.title}</h3>
                                    {asset.headline && <p className="text-sm text-muted-foreground">{asset.headline}</p>}
                                    <p className="text-xs text-muted-foreground/70">
                                        {new Date(asset.createdAt).toLocaleDateString("pt-BR")}
                                    </p>
                                </div>
                                <AuthorityStatusActions
                                    assetId={asset.id}
                                    status={asset.status}
                                    apiBasePath="/api/agency/authority"
                                    onStatusChanged={loadData}
                                />
                            </div>

                            <div className="rounded-lg border border-border/30 bg-muted/10 p-3">
                                <pre className="whitespace-pre-wrap text-xs">{asset.body}</pre>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                {"operationalSavingsPerYear" in parsedMetrics && (
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                        economia: R$ {Math.round(parsedMetrics.operationalSavingsPerYear ?? 0).toLocaleString("pt-BR")}/ano
                                    </span>
                                )}
                                {"revenueIncreasePerYear" in parsedMetrics && (
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                        receita: R$ {Math.round(parsedMetrics.revenueIncreasePerYear ?? 0).toLocaleString("pt-BR")}/ano
                                    </span>
                                )}
                                <button
                                    onClick={() => copyText(asset.id, asset.body)}
                                    className="inline-flex items-center gap-1 rounded-full border border-border/40 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    <Copy className="h-3 w-3" /> {copied === asset.id ? "copiado" : "copiar texto"}
                                </button>
                                {asset.publishedUrl && (
                                    <a href={asset.publishedUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">
                                        abrir publicacao
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
