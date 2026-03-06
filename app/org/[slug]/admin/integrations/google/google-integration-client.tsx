"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Link, Unlink, TestTube2 } from "lucide-react";

interface IntegrationState {
    status: string;
    ownerEmail?: string | null;
    lastError?: string | null;
    calendarId?: string | null;
    updatedAt?: string | null;
}

interface Props {
    orgSlug: string;
    integration: IntegrationState | null;
}

export function GoogleIntegrationClient({ orgSlug, integration }: Props) {
    const [loading, setLoading] = useState<null | "test" | "disconnect">(null);
    const [testResult, setTestResult] = useState<{ meetingUrl?: string; error?: string } | null>(null);

    const isConnected = integration?.status === "connected";

    const handleConnect = () => {
        window.location.href = `/api/admin/integrations/google/start`;
    };

    const handleDisconnect = async () => {
        if (!confirm("Tem certeza que quer desconectar o Google Calendar?")) return;
        setLoading("disconnect");
        try {
            await fetch("/api/admin/integrations/google/disconnect", { method: "POST" });
            window.location.reload();
        } finally {
            setLoading(null);
        }
    };

    const handleTest = async () => {
        setLoading("test");
        setTestResult(null);
        try {
            const res = await fetch("/api/admin/integrations/google/test", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setTestResult({ meetingUrl: data.meetingUrl });
            } else {
                setTestResult({ error: data.error ?? "Erro desconhecido" });
            }
        } catch (e: any) {
            setTestResult({ error: e.message });
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Status Card */}
            <div className={`rounded-2xl border p-6 space-y-4 ${isConnected ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-white/3"}`}>
                <div className="flex items-center gap-3">
                    {isConnected ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : integration?.status === "error" ? (
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    ) : (
                        <XCircle className="w-5 h-5 text-red-400/50" />
                    )}
                    <div>
                        <p className="font-bold text-sm">
                            {isConnected ? "Conectado" : integration?.status === "error" ? "Erro na integração" : "Não conectado"}
                        </p>
                        {isConnected && integration?.ownerEmail && (
                            <p className="text-xs text-muted-foreground">{integration.ownerEmail}</p>
                        )}
                        {integration?.lastError && (
                            <p className="text-xs text-red-400 mt-1">{integration.lastError}</p>
                        )}
                    </div>
                </div>

                {isConnected && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-muted-foreground mb-0.5">Calendário</p>
                            <p className="font-mono font-semibold">{integration?.calendarId ?? "primary"}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-muted-foreground mb-0.5">Última atualização</p>
                            <p className="font-semibold">{integration?.updatedAt ? new Date(integration.updatedAt).toLocaleDateString("pt-BR") : "—"}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
                {!isConnected ? (
                    <button
                        onClick={handleConnect}
                        className="w-full flex items-center justify-center gap-3 bg-white text-[#030712] font-bold py-3 rounded-xl hover:bg-white/90 transition-colors"
                    >
                        <Link className="w-4 h-4" />
                        Conectar Google Calendar
                    </button>
                ) : (
                    <>
                        <button
                            onClick={handleTest}
                            disabled={!!loading}
                            className="w-full flex items-center justify-center gap-3 bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold py-3 rounded-xl hover:bg-blue-600/30 transition-colors disabled:opacity-50"
                        >
                            {loading === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
                            Criar evento de teste com Meet
                        </button>
                        <button
                            onClick={handleDisconnect}
                            disabled={!!loading}
                            className="w-full flex items-center justify-center gap-3 bg-red-600/10 text-red-400 border border-red-500/20 font-semibold py-3 rounded-xl hover:bg-red-600/20 transition-colors disabled:opacity-50"
                        >
                            {loading === "disconnect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                            Desconectar
                        </button>
                    </>
                )}
            </div>

            {/* Test Result */}
            {testResult && (
                <div className={`rounded-xl border p-4 text-sm ${testResult.meetingUrl ? "border-green-500/30 bg-green-500/5 text-green-300" : "border-red-500/30 bg-red-500/5 text-red-300"}`}>
                    {testResult.meetingUrl ? (
                        <div className="space-y-2">
                            <p className="font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Evento criado com sucesso!</p>
                            <a href={testResult.meetingUrl} target="_blank" rel="noreferrer" className="underline text-xs font-mono break-all">
                                {testResult.meetingUrl}
                            </a>
                        </div>
                    ) : (
                        <p className="flex items-center gap-2"><XCircle className="w-4 h-4" /> {testResult.error}</p>
                    )}
                </div>
            )}

            {/* How it works */}
            <div className="rounded-xl border border-white/5 bg-white/3 p-5 space-y-3">
                <p className="font-bold text-sm">Como funciona</p>
                <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                    <li>Quando um lead agenda via Calendly, o webhook recebe o evento.</li>
                    <li>O Meeting Intelligence cria a <code className="bg-white/10 px-1 rounded">MeetingSession</code> no banco.</li>
                    <li>Se o Google Calendar estiver conectado, um evento é criado automaticamente com link do Meet.</li>
                    <li>O link do Meet é salvo na sessão e pode ser enviado ao lead via automação.</li>
                </ol>
            </div>
        </div>
    );
}
