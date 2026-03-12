import puppeteer from "puppeteer";
import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { prisma } from "@/lib/prisma";
import { calculateROI } from "@/lib/roi-engine";
import { storeDossierPdf } from "@/lib/pdf/storage";
import { trackUsage } from "@/lib/usage";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/runtime/base-url";
import { writeAuditEvent } from "@/lib/audit";

export type DossierPdfStatus = "not_requested" | "queued" | "processing" | "ready" | "failed";

export interface DossierPdfMeta {
    status: DossierPdfStatus;
    url?: string;
    storageKey?: string;
    requestedAt?: string;
    generatedAt?: string;
    error?: string;
    queueId?: string;
}

export interface DossierPdfState {
    found: boolean;
    slug: string;
    reportId?: string;
    organizationId?: string;
    assessmentId?: string;
    status: DossierPdfStatus;
    url?: string;
    storageKey?: string;
    requestedAt?: string;
    generatedAt?: string;
    error?: string;
    queueId?: string;
}

const PDF_META_KEY = "__pdf";
const PDF_ACTION_TYPE = "generate_pdf_report";

type ReportWithAssessment = {
    id: string;
    assessmentId: string;
    publicSlug: string;
    contentJson: string;
    version: number;
    assessment: {
        id: string;
        organizationId: string;
        company: string;
        createdAt: Date;
        teamSize: string;
        volumeDay: string;
        scoreTotal: number;
        classification: string;
        pains: string;
        recommendedMissions: string;
    };
};

type QueueStatus = "pending" | "review_required" | "approved";

type QueueItemRecord = {
    id: string;
};

type RoiProjectionRecord = {
    avgHourlyCost: number | null;
    avgTicket: number | null;
    conversionRate: number | null;
};

type ArtifactReportContentRecord = {
    id: string;
    contentJson: string;
};

type ActionQueueDelegate = {
    findFirst(args: {
        where: {
            organizationId: string;
            type: string;
            relatedEntityType: string;
            relatedEntityId: string;
            status: { in: QueueStatus[] };
        };
        orderBy: { createdAt: "desc" };
    }): Promise<QueueItemRecord | null>;
    create(args: {
        data: {
            organizationId: string;
            type: string;
            payloadJson: string;
            priority: "high";
            status: "pending";
            approvalRequired: boolean;
            relatedEntityType: string;
            relatedEntityId: string;
            reason: string;
        };
    }): Promise<QueueItemRecord>;
};

type RoiProjectionDelegate = {
    findUnique(args: { where: { assessmentId: string } }): Promise<RoiProjectionRecord | null>;
};

type ArtifactReportDelegate = {
    findUnique(args: {
        where: { publicSlug: string };
        include: unknown;
    }): Promise<ReportWithAssessment | null>;
    findUnique(args: {
        where: { id: string };
        include: unknown;
    }): Promise<ReportWithAssessment | null>;
    findUnique(args: {
        where: { id: string };
        select: { id: true; contentJson: true };
    }): Promise<ArtifactReportContentRecord | null>;
    update(args: {
        where: { id: string };
        data: { contentJson: string };
    }): Promise<unknown>;
};

const actionQueue = (prisma as unknown as { actionQueue: ActionQueueDelegate }).actionQueue;
const roiProjection = (prisma as unknown as { roiProjection: RoiProjectionDelegate }).roiProjection;
const artifactReport = (prisma as unknown as { artifactReport: ArtifactReportDelegate }).artifactReport;

export async function getDossierPdfStateBySlug(slug: string): Promise<DossierPdfState> {
    const report = await findReportBySlug(slug);
    if (!report) {
        return { found: false, slug, status: "not_requested" };
    }

    const meta = getPdfMetaFromContent(report.contentJson);
    return {
        found: true,
        slug,
        reportId: report.id,
        organizationId: report.assessment.organizationId,
        assessmentId: report.assessmentId,
        status: meta.status,
        url: meta.url,
        storageKey: meta.storageKey,
        requestedAt: meta.requestedAt,
        generatedAt: meta.generatedAt,
        error: meta.error,
        queueId: meta.queueId,
    };
}

export async function queueDossierPdfGenerationBySlug(slug: string): Promise<DossierPdfState> {
    const report = await findReportBySlug(slug);
    if (!report) {
        return { found: false, slug, status: "not_requested" };
    }

    const meta = getPdfMetaFromContent(report.contentJson);
    if (meta.status === "ready" && meta.url) {
        return {
            found: true,
            slug,
            reportId: report.id,
            organizationId: report.assessment.organizationId,
            assessmentId: report.assessmentId,
            status: "ready",
            url: meta.url,
            storageKey: meta.storageKey,
            requestedAt: meta.requestedAt,
            generatedAt: meta.generatedAt,
            queueId: meta.queueId,
        };
    }

    const existingQueueItem = await actionQueue.findFirst({
        where: {
            organizationId: report.assessment.organizationId,
            type: PDF_ACTION_TYPE,
            relatedEntityType: "artifact_report",
            relatedEntityId: report.id,
            status: { in: ["pending", "review_required", "approved"] },
        },
        orderBy: { createdAt: "desc" },
    });

    const queueItem = existingQueueItem
        ? existingQueueItem
        : await actionQueue.create({
            data: {
                organizationId: report.assessment.organizationId,
                type: PDF_ACTION_TYPE,
                payloadJson: JSON.stringify({ reportId: report.id, slug: report.publicSlug }),
                priority: "high",
                status: "pending",
                approvalRequired: false,
                relatedEntityType: "artifact_report",
                relatedEntityId: report.id,
                reason: "dossier_pdf_generation",
            },
        });

    const nextMeta = await updatePdfMeta(report.id, (current) => ({
        ...current,
        status: current.status === "processing" ? "processing" : "queued",
        requestedAt: current.requestedAt ?? new Date().toISOString(),
        error: undefined,
        queueId: queueItem.id,
    }));

    return {
        found: true,
        slug,
        reportId: report.id,
        organizationId: report.assessment.organizationId,
        assessmentId: report.assessmentId,
        status: nextMeta.status,
        url: nextMeta.url,
        storageKey: nextMeta.storageKey,
        requestedAt: nextMeta.requestedAt,
        generatedAt: nextMeta.generatedAt,
        error: nextMeta.error,
        queueId: nextMeta.queueId,
    };
}

export async function generateAndStoreDossierPdf(payload: {
    reportId?: string;
    slug?: string;
    orgId?: string;
}): Promise<{ slug: string; url: string; storageKey: string; sizeBytes: number }> {
    const report = payload.reportId
        ? await findReportById(payload.reportId)
        : payload.slug
            ? await findReportBySlug(payload.slug)
            : null;

    if (!report) {
        throw new Error("Artifact report not found for PDF generation.");
    }

    if (payload.orgId && payload.orgId !== report.assessment.organizationId) {
        throw new Error("Forbidden organization for this PDF job.");
    }

    await updatePdfMeta(report.id, (current) => ({
        ...current,
        status: "processing",
        requestedAt: current.requestedAt ?? new Date().toISOString(),
        error: undefined,
    }));

    try {
        const reportContent = parseContentObject(report.contentJson);
        const projection = await roiProjection.findUnique({
            where: { assessmentId: report.assessmentId },
        });

        const roi = calculateROI({
            teamSize: report.assessment.teamSize,
            volumeDay: report.assessment.volumeDay,
            scoreTotal: report.assessment.scoreTotal,
            classification: report.assessment.classification,
            pains: parseJsonArray(report.assessment.pains),
            ...(projection
                ? {
                    avgHourlyCost: projection.avgHourlyCost ?? undefined,
                    avgTicket: projection.avgTicket ?? undefined,
                    conversionRate: projection.conversionRate ?? undefined,
                }
                : {}),
        });

        const blueprint = asRecord(reportContent.blueprint);
        const html = buildDossierHtml({
            company: report.assessment.company,
            createdAt: report.assessment.createdAt.toLocaleDateString("pt-BR"),
            slug: report.publicSlug,
            scoreTotal: report.assessment.scoreTotal,
            classification: report.assessment.classification,
            recommendedMissions: parseJsonArray(report.assessment.recommendedMissions),
            roadmap: Array.isArray(reportContent.roadmap) ? reportContent.roadmap : [],
            risks: Array.isArray(reportContent.risks) ? reportContent.risks : [],
            modules: Array.isArray(blueprint.modules) ? blueprint.modules.map((item) => String(item)) : [],
            integrations: Array.isArray(blueprint.integrations) ? blueprint.integrations.map((item) => String(item)) : [],
            roi,
        });

        const pdfBuffer = await renderPdfBuffer(html);
        const filename = `inovacortex-dossie-${safeFragment(report.assessment.company)}.pdf`;

        const storage = await storeDossierPdf({
            organizationId: report.assessment.organizationId,
            slug: report.publicSlug,
            filename,
            buffer: pdfBuffer,
        });

        const publicUrl = toPublicUrl(storage.url);
        const generatedAtIso = new Date().toISOString();

        await updatePdfMeta(report.id, (current) => ({
            ...current,
            status: "ready",
            url: publicUrl,
            storageKey: storage.storageKey,
            generatedAt: generatedAtIso,
            error: undefined,
        }));

        await writeAuditEvent({
            organizationId: report.assessment.organizationId,
            assessmentId: report.assessmentId,
            action: "pdfGenerated",
            details: {
                slug: report.publicSlug,
                storageKey: storage.storageKey,
                url: publicUrl,
                generatedAt: generatedAtIso,
            },
            strict: true,
            context: { reportId: report.id, slug: report.publicSlug },
        });

        await trackUsage(report.assessment.organizationId, "pdfGenerated", 1, {
            slug: report.publicSlug,
            url: publicUrl,
        });

        return {
            slug: report.publicSlug,
            url: publicUrl,
            storageKey: storage.storageKey,
            sizeBytes: pdfBuffer.byteLength,
        };
    } catch (error) {
        const message = normalizeErrorMessage(error);
        logger.error("[PDF] generation failed", { slug: report.publicSlug, reportId: report.id, error: message });

        await updatePdfMeta(report.id, (current) => ({
            ...current,
            status: "failed",
            error: message,
            generatedAt: undefined,
        }));

        throw error;
    }
}

export function getPdfMetaFromContent(contentJson: string): DossierPdfMeta {
    const content = parseContentObject(contentJson);
    const raw = asRecord(content[PDF_META_KEY]);

    const status = normalizeStatus(raw.status);
    const url = asOptionalString(raw.url);
    const storageKey = asOptionalString(raw.storageKey);
    const requestedAt = asOptionalString(raw.requestedAt);
    const generatedAt = asOptionalString(raw.generatedAt);
    const error = asOptionalString(raw.error);
    const queueId = asOptionalString(raw.queueId);

    return { status, url, storageKey, requestedAt, generatedAt, error, queueId };
}

async function findReportBySlug(slug: string): Promise<ReportWithAssessment | null> {
    return artifactReport.findUnique({
        where: { publicSlug: slug },
        include: {
            assessment: {
                select: {
                    id: true,
                    organizationId: true,
                    company: true,
                    createdAt: true,
                    teamSize: true,
                    volumeDay: true,
                    scoreTotal: true,
                    classification: true,
                    pains: true,
                    recommendedMissions: true,
                },
            },
        },
    });
}

async function findReportById(reportId: string): Promise<ReportWithAssessment | null> {
    return artifactReport.findUnique({
        where: { id: reportId },
        include: {
            assessment: {
                select: {
                    id: true,
                    organizationId: true,
                    company: true,
                    createdAt: true,
                    teamSize: true,
                    volumeDay: true,
                    scoreTotal: true,
                    classification: true,
                    pains: true,
                    recommendedMissions: true,
                },
            },
        },
    });
}

async function updatePdfMeta(reportId: string, updater: (current: DossierPdfMeta) => DossierPdfMeta): Promise<DossierPdfMeta> {
    const report = await artifactReport.findUnique({
        where: { id: reportId },
        select: { id: true, contentJson: true },
    });

    if (!report) {
        throw new Error("Artifact report not found while updating PDF metadata.");
    }

    const content = parseContentObject(report.contentJson);
    const current = getPdfMetaFromContent(report.contentJson);
    const next = updater(current);

    content[PDF_META_KEY] = {
        status: next.status,
        url: next.url ?? null,
        storageKey: next.storageKey ?? null,
        requestedAt: next.requestedAt ?? null,
        generatedAt: next.generatedAt ?? null,
        error: next.error ?? null,
        queueId: next.queueId ?? null,
    };

    await artifactReport.update({
        where: { id: report.id },
        data: { contentJson: JSON.stringify(content) },
    });

    return next;
}

async function renderPdfBuffer(html: string): Promise<Buffer> {
    const wsEndpoint = (process.env.PDF_BROWSER_WS_ENDPOINT ?? "").trim();
    const useRemoteBrowser = wsEndpoint.length > 0;
    const isVercel = process.env.VERCEL === "1" || !!process.env.AWS_EXECUTION_ENV;

    let browser: any = null;
    try {
        if (useRemoteBrowser) {
            browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
        } else if (isVercel) {
            browser = await puppeteerCore.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: await chromium.executablePath(),
                headless: chromium.headless,
            });
        } else {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ],
            });
        }

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "domcontentloaded" });
        const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "14mm", right: "12mm", bottom: "14mm", left: "12mm" },
        });

        return Buffer.from(pdf);
    } catch (error) {
        throw new Error(`PDF render failed: ${normalizeErrorMessage(error)}`);
    } finally {
        if (browser) {
            if (useRemoteBrowser) {
                (browser as any).disconnect();
            } else {
                await (browser as any).close().catch(() => null);
            }
        }
    }
}

function buildDossierHtml(input: {
    company: string;
    createdAt: string;
    slug: string;
    scoreTotal: number;
    classification: string;
    recommendedMissions: string[];
    roadmap: Array<{ phase?: string; title?: string; description?: string }>;
    risks: string[];
    modules: string[];
    integrations: string[];
    roi: {
        operationalSavingsEstimate: number;
        revenueIncreaseEstimate: number;
        monthlyHoursRecovered: number;
        estimatedPaybackMonths: number;
        confidenceLevel: string;
        savingsRange: string;
        revenueRange: string;
        hoursRange: string;
    };
}): string {
    const score = Number.isFinite(input.scoreTotal) ? input.scoreTotal : 0;
    const shortHash = input.slug.slice(0, 8);
    const missionItems = input.recommendedMissions
        .map((mission) => `<li>${escapeHtml(mission)}</li>`)
        .join("");
    const moduleItems = input.modules.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
    const integrationItems = input.integrations.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
    const roadmapItems = input.roadmap
        .map((step) => {
            const phase = escapeHtml(step.phase ?? "phase");
            const title = escapeHtml(step.title ?? "step");
            const description = escapeHtml(step.description ?? "");
            return `<li><strong>${phase}</strong> - ${title}<br/><span>${description}</span></li>`;
        })
        .join("");
    const riskItems = input.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("");

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dossie InovaCortex - ${escapeHtml(input.company)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; color: #111827; background: #ffffff; }
    .page { max-width: 760px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    h2 { margin: 30px 0 10px; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    p { margin: 6px 0; }
    ul { margin: 8px 0 0 18px; padding: 0; }
    li { margin: 6px 0; }
    .muted { color: #4b5563; font-size: 12px; }
    .row { display: flex; gap: 14px; }
    .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; flex: 1; }
    .score { font-size: 44px; font-weight: bold; color: #1d4ed8; line-height: 1; }
    .roi { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .roi .card p:first-child { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
    .roi .card p:last-child { font-size: 22px; font-weight: 700; color: #111827; margin-top: 4px; }
    .footer { margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 11px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="page">
    <h1>Dossie de Diagnostico Tecnico</h1>
    <p class="muted">Empresa: ${escapeHtml(input.company)} | Gerado em: ${escapeHtml(input.createdAt)} | Hash: ${escapeHtml(shortHash)}</p>

    <h2>Potencial de Automacao</h2>
    <div class="row">
      <div class="card">
        <div class="score">${score}<span style="font-size:20px;color:#6b7280;">/100</span></div>
        <p><strong>${escapeHtml(input.classification)}</strong></p>
      </div>
      <div class="card">
        <p><strong>Missoes recomendadas</strong></p>
        <ul>${missionItems}</ul>
      </div>
    </div>

    <h2>Impacto financeiro estimado</h2>
    <div class="roi">
      <div class="card"><p>Economia mensal</p><p>${formatBRL(input.roi.operationalSavingsEstimate)}</p><p class="muted">${escapeHtml(input.roi.savingsRange)}</p></div>
      <div class="card"><p>Receita mensal</p><p>${formatBRL(input.roi.revenueIncreaseEstimate)}</p><p class="muted">${escapeHtml(input.roi.revenueRange)}</p></div>
      <div class="card"><p>Horas recuperadas</p><p>${Math.round(input.roi.monthlyHoursRecovered)}h</p><p class="muted">${escapeHtml(input.roi.hoursRange)}</p></div>
      <div class="card"><p>Payback</p><p>${Number(input.roi.estimatedPaybackMonths).toFixed(1)} meses</p><p class="muted">Confianca: ${escapeHtml(input.roi.confidenceLevel)}</p></div>
    </div>

    <h2>Blueprint recomendado</h2>
    <div class="row">
      <div class="card"><p><strong>Modulos</strong></p><ul>${moduleItems}</ul></div>
      <div class="card"><p><strong>Integracoes</strong></p><ul>${integrationItems}</ul></div>
    </div>

    <h2>Roadmap 30 dias</h2>
    <ul>${roadmapItems}</ul>

    <h2>Riscos operacionais</h2>
    <ul>${riskItems}</ul>

    <div class="footer">
      Documento gerado pela InovaCortex. Este arquivo pode ser reutilizado em fluxos de atendimento, email e WhatsApp.
    </div>
  </div>
</body>
</html>`;
}

function parseContentObject(contentJson: string): Record<string, unknown> {
    if (!contentJson) return {};
    try {
        const parsed = JSON.parse(contentJson) as unknown;
        return asRecord(parsed);
    } catch {
        return {};
    }
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

function normalizeStatus(value: unknown): DossierPdfStatus {
    if (value === "queued" || value === "processing" || value === "ready" || value === "failed") {
        return value;
    }
    return "not_requested";
}

function asOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function parseJsonArray(raw: string): string[] {
    try {
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
        return [];
    }
}

function toPublicUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) {
        return url;
    }
    const baseUrl = getBaseUrl();
    return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

function normalizeErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

function safeFragment(value: string): string {
    return value
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "")
        .slice(0, 40) || "empresa";
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatBRL(amount: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    }).format(Number.isFinite(amount) ? amount : 0);
}
