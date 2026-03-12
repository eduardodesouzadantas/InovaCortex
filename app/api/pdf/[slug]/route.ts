import { NextRequest, NextResponse } from "next/server";
import { getDossierPdfStateBySlug, generateAndStoreDossierPdf } from "@/lib/pdf/dossier-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120000;

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    
    // Check current state before generating
    const state = await getDossierPdfStateBySlug(slug);

    if (!state.found) {
        return NextResponse.json({ error: "Dossie nao encontrado" }, { status: 404 });
    }

    if (state.status === "ready" && state.url) {
        return NextResponse.json(
            {
                slug,
                status: "ready",
                pdfUrl: state.url,
                requestedAt: state.requestedAt ?? null,
                generatedAt: state.generatedAt ?? null,
                error: null,
                queueId: state.queueId ?? null,
                statusUrl: `/api/pdf/${encodeURIComponent(slug)}?mode=status`,
                downloadUrl: state.url,
            },
            { status: 200 }
        );
    }

    try {
        const result = await generateAndStoreDossierPdf({ slug });
        return NextResponse.json(
            {
                slug: result.slug,
                status: "ready",
                pdfUrl: result.url,
                requestedAt: state.requestedAt ?? new Date().toISOString(),
                generatedAt: new Date().toISOString(),
                error: null,
                queueId: null,
                statusUrl: `/api/pdf/${encodeURIComponent(slug)}?mode=status`,
                downloadUrl: result.url,
            },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { error: String(error), status: "failed" }, 
            { status: 500 }
        );
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const mode = request.nextUrl.searchParams.get("mode") ?? "download";

    const state = await getDossierPdfStateBySlug(slug);
    if (!state.found) {
        if (mode === "status") {
            return NextResponse.json({ error: "Dossie nao encontrado" }, { status: 404 });
        }
        return new NextResponse("Dossie nao encontrado", { status: 404 });
    }

    if (mode === "file") {
        if (state.status !== "ready") {
            return new NextResponse("PDF ainda nao esta pronto", { status: 409 });
        }

        if (!state.inlineBase64) {
            return new NextResponse("Arquivo PDF nao disponivel", { status: 404 });
        }

        const pdfBuffer = Buffer.from(state.inlineBase64, "base64");
        const filename = `${sanitizeFilename(slug)}.pdf`;
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        });
    }

    if (mode === "status") {
        return NextResponse.json({
            slug,
            status: state.status,
            pdfUrl: state.url ?? null,
            requestedAt: state.requestedAt ?? null,
            generatedAt: state.generatedAt ?? null,
            error: state.error ?? null,
            queueId: state.queueId ?? null,
            downloadUrl: state.url ?? null,
        });
    }

    if (state.status === "ready" && state.url) {
        return NextResponse.redirect(buildRedirectUrl(request.url, state.url), 307);
    }

    // Removed queue mapping, POST endpoint now handles synchronous blocking generation

    if (mode === "download") {
        return new NextResponse(buildPendingHtml(slug), {
            status: 202,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
                "Retry-After": "2",
            },
        });
    }

    return NextResponse.json(
        {
            slug,
            status: "queued",
            statusUrl: `/api/pdf/${encodeURIComponent(slug)}?mode=status`,
            downloadUrl: `/api/pdf/${encodeURIComponent(slug)}?mode=download`,
        },
        { status: 202 }
    );
}

function buildRedirectUrl(requestUrl: string, targetUrl: string): URL {
    if (/^https?:\/\//i.test(targetUrl)) {
        return new URL(targetUrl);
    }
    return new URL(targetUrl, requestUrl);
}

function buildPendingHtml(slug: string): string {
    const safeSlug = encodeURIComponent(slug);
    const statusUrl = `/api/pdf/${safeSlug}?mode=status`;
    const requestUrl = `/api/pdf/${safeSlug}`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Gerando PDF</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0b1220; color: #e5e7eb; margin: 0; padding: 0; }
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { width: 100%; max-width: 560px; background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 24px; }
    h1 { margin: 0 0 10px; font-size: 22px; }
    p { margin: 0 0 10px; color: #9ca3af; }
    .status { margin-top: 12px; font-size: 14px; color: #d1d5db; }
    .meta { margin-top: 10px; font-size: 12px; color: #9ca3af; }
    .error { margin-top: 14px; color: #fca5a5; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Seu PDF esta sendo preparado</h1>
      <p>O arquivo sera gerado em background, salvo no storage e liberado para download automatico.</p>
      <div class="status" id="status">Solicitando geracao...</div>
      <div class="meta" id="meta"></div>
      <div class="error" id="error"></div>
    </div>
  </div>
  <script>
    const pollInterval = ${POLL_INTERVAL_MS};
    const timeoutMs = ${POLL_TIMEOUT_MS};
    const startedAt = Date.now();

    async function ensureQueued() {
      await fetch("${requestUrl}", { method: "POST" }).catch(() => null);
    }

    async function checkStatus() {
      const statusEl = document.getElementById("status");
      const metaEl = document.getElementById("meta");
      const errorEl = document.getElementById("error");

      try {
        const res = await fetch("${statusUrl}", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) {
          statusEl.textContent = "Nao foi possivel consultar o status do PDF.";
          errorEl.textContent = data?.error || "Erro desconhecido";
          return;
        }

        statusEl.textContent = "Status atual: " + data.status;
        metaEl.textContent = data.generatedAt
          ? ("Gerado em: " + new Date(data.generatedAt).toLocaleString("pt-BR"))
          : (data.requestedAt ? "Solicitado em: " + new Date(data.requestedAt).toLocaleString("pt-BR") : "");

        if (data.status === "ready" && data.pdfUrl) {
          window.location.href = data.pdfUrl;
          return;
        }

        if (data.status === "failed") {
          errorEl.textContent = data.error || "Falha ao gerar PDF. Tente novamente em instantes.";
          return;
        }
      } catch (err) {
        statusEl.textContent = "Aguardando disponibilidade do PDF...";
      }

      if (Date.now() - startedAt > timeoutMs) {
        const errorElTimeout = document.getElementById("error");
        errorElTimeout.textContent = "Tempo limite excedido. O PDF continua em processamento no backend.";
        return;
      }

      setTimeout(checkStatus, pollInterval);
    }

    ensureQueued().then(checkStatus);
  </script>
</body>
</html>`;
}

function sanitizeFilename(value: string): string {
    return (
        value
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9\-_.]/g, "")
            .slice(0, 120) || "dossie"
    );
}

