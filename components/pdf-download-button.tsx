"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface PdfDownloadButtonProps {
    slug: string;
    className?: string;
    label?: string;
    title?: string;
}

export function PdfDownloadButton({
    slug,
    className,
    label = "Baixar PDF",
    title,
}: PdfDownloadButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleDownload = async () => {
        if (isLoading) return;

        setIsLoading(true);
        try {
            const start = await fetch(`/api/pdf/${encodeURIComponent(slug)}?force=1`, {
                method: "POST",
                cache: "no-store",
            });
            const startPayload = await safeJson(start);

            if (!start.ok) {
                throw new Error(extractError(startPayload) ?? "Falha ao iniciar geracao do PDF.");
            }

            if (startPayload?.status === "ready" && typeof startPayload?.pdfUrl === "string") {
                triggerBackgroundDownload(startPayload.pdfUrl);
                return;
            }

            const readyUrl = await pollReadyPdfUrl(slug);
            triggerBackgroundDownload(readyUrl);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Nao foi possivel baixar o PDF agora.";
            console.error("[PDF] download failed", { slug, message });
            alert(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleDownload}
            disabled={isLoading}
            className={className}
            title={title}
        >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isLoading ? "Preparando PDF..." : label}
        </button>
    );
}

async function pollReadyPdfUrl(slug: string): Promise<string> {
    const maxAttempts = 45;
    const intervalMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const res = await fetch(`/api/pdf/${encodeURIComponent(slug)}?mode=status`, {
            cache: "no-store",
        });
        const data = await safeJson(res);

        if (!res.ok) {
            throw new Error(extractError(data) ?? "Nao foi possivel consultar o status do PDF.");
        }

        if (data?.status === "ready" && typeof data?.pdfUrl === "string") {
            return data.pdfUrl;
        }

        if (data?.status === "failed") {
            throw new Error(extractError(data) ?? "Falha ao gerar PDF.");
        }

        await sleep(intervalMs);
    }

    throw new Error("PDF ainda em processamento. Tente novamente em instantes.");
}

function triggerBackgroundDownload(url: string): void {
    const absoluteUrl = toAbsoluteUrl(url);
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = absoluteUrl;
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    window.setTimeout(() => {
        iframe.remove();
    }, 45000);
}

function toAbsoluteUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) {
        return url;
    }
    return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

async function safeJson(response: Response): Promise<any> {
    try {
        return await response.json();
    } catch {
        return {};
    }
}

function extractError(payload: any): string | null {
    if (!payload) return null;
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
    return null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
