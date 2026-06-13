import chromium from "@sparticuz/chromium";
import { existsSync } from "fs";
import { unlink } from "fs/promises";
import puppeteer, { type Browser } from "puppeteer-core";

export interface GeneratePdfInput {
    html: string;
    companyName: string;
    reportId: string;
}

export interface PdfRendererHealth {
    ready: boolean;
    mode: "remote_browser" | "local_browser" | "text_fallback" | "unavailable";
    detail?: string;
    checkedAt: string;
}

const PDF_HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;

let pdfRendererHealthCache: PdfRendererHealth | null = null;
let pdfRendererHealthPromise: Promise<PdfRendererHealth> | null = null;

export async function generatePdfFromHtml(input: GeneratePdfInput): Promise<Buffer> {
    let browser: Browser | null = null;
    let remote = false;

    try {
        await preloadFonts();
        const launched = await launchBrowser();
        browser = launched.browser;
        remote = launched.remote;

        const page = await browser.newPage();
        await page.emulateMediaType("screen");
        await page.setContent(input.html, { waitUntil: "networkidle0" });
        await page.evaluateHandle("document.fonts.ready");
        await page.waitForFunction("window.__REPORT_READY === true", { timeout: 15000 }).catch(() => null);

        const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: buildHeaderTemplate(input.companyName),
            footerTemplate: buildFooterTemplate(input.reportId),
            margin: {
                top: "20mm",
                right: "11mm",
                bottom: "17mm",
                left: "11mm",
            },
        });

        return Buffer.from(pdf);
    } catch (error) {
        const message = normalizeError(error);
        if (shouldFallback(message)) {
            return buildTextFallbackPdfBuffer(input, message);
        }
        throw new Error(`Business MRI PDF generation failed: ${message}`);
    } finally {
        if (browser) {
            if (remote) {
                browser.disconnect();
            } else {
                await browser.close().catch(() => null);
            }
        }
    }
}

export async function generatePDF(html: string): Promise<Buffer> {
    return generatePdfFromHtml({
        html,
        companyName: "InovaCortex",
        reportId: "business-mri",
    });
}

export async function checkPdfRendererHealth(): Promise<PdfRendererHealth> {
    if (pdfRendererHealthCache) {
        const checkedAtMs = new Date(pdfRendererHealthCache.checkedAt).getTime();
        if (Date.now() - checkedAtMs < PDF_HEALTH_CACHE_TTL_MS) {
            return pdfRendererHealthCache;
        }
    }

    if (pdfRendererHealthPromise) {
        return pdfRendererHealthPromise;
    }

    pdfRendererHealthPromise = (async () => {
        let browser: Browser | null = null;
        let remote = false;

        try {
            await preloadFonts();
            const launched = await launchBrowser();
            browser = launched.browser;
            remote = launched.remote;

            const page = await browser.newPage();
            await page.setContent("<html><body><h1>system-health</h1></body></html>", { waitUntil: "domcontentloaded" });
            const pdfBuffer = await page.pdf({
                format: "A4",
                printBackground: false,
                margin: {
                    top: "10mm",
                    right: "10mm",
                    bottom: "10mm",
                    left: "10mm",
                },
            });

            const result: PdfRendererHealth = {
                ready: Buffer.byteLength(Buffer.from(pdfBuffer)) > 0,
                mode: remote ? "remote_browser" : "local_browser",
                checkedAt: new Date().toISOString(),
            };
            pdfRendererHealthCache = result;
            return result;
        } catch (error) {
            const message = normalizeError(error);
            const result: PdfRendererHealth = shouldFallback(message)
                ? {
                    ready: true,
                    mode: "text_fallback",
                    detail: message,
                    checkedAt: new Date().toISOString(),
                }
                : {
                    ready: false,
                    mode: "unavailable",
                    detail: message,
                    checkedAt: new Date().toISOString(),
                };

            pdfRendererHealthCache = result;
            return result;
        } finally {
            pdfRendererHealthPromise = null;

            if (browser) {
                if (remote) {
                    browser.disconnect();
                } else {
                    await browser.close().catch(() => null);
                }
            }
        }
    })();

    return pdfRendererHealthPromise;
}

async function launchBrowser(): Promise<{ browser: Browser; remote: boolean }> {
    const wsEndpoint = (process.env.PDF_BROWSER_WS_ENDPOINT ?? "").trim();
    if (wsEndpoint) {
        const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
        return { browser, remote: true };
    }

    const errors: string[] = [];
    try {
        const executablePath = await resolveExecutablePath();
        const browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--font-render-hinting=none",
                "--single-process",
                "--hide-scrollbars",
            ],
            executablePath,
            headless: chromium.headless,
            defaultViewport: chromium.defaultViewport ?? {
                width: 1280,
                height: 1810,
                deviceScaleFactor: 2,
            },
        });
        return { browser, remote: false };
    } catch (error) {
        errors.push(normalizeError(error));
    }

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });
        return { browser, remote: false };
    } catch (error) {
        errors.push(normalizeError(error));
    }

    throw new Error(`Unable to launch browser for PDF generation. Attempts: ${errors.join(" | ")}`);
}

async function resolveExecutablePath(): Promise<string> {
    const configured =
        (process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROMIUM_EXECUTABLE_PATH ?? "").trim();

    hintServerlessRuntimeForChromium();
    ensureSharedLibraryPath();
    await invalidateBrokenChromiumCache();

    if (configured) return configured;
    return chromium.executablePath();
}

async function preloadFonts(): Promise<void> {
    const customFont = (process.env.PDF_FONT_REGULAR_URL ?? "").trim();
    if (!customFont) return;
    await chromium.font(customFont).catch(() => null);
}

function ensureSharedLibraryPath(): void {
    const extraPaths = ["/tmp/al2/lib", "/tmp/al2023/lib", "/tmp/lib", "/var/task/lib"];
    const current = (process.env.LD_LIBRARY_PATH ?? "")
        .split(":")
        .map((part) => part.trim())
        .filter(Boolean);

    for (const path of extraPaths) {
        if (!current.includes(path)) current.push(path);
    }
    process.env.LD_LIBRARY_PATH = current.join(":");

    // Required by @sparticuz/chromium font stack; without it PDF can render without visible text.
    process.env.FONTCONFIG_PATH ??= "/tmp/fonts";
    process.env.HOME ??= "/tmp";
}

function hintServerlessRuntimeForChromium(): void {
    const isVercelRuntime =
        process.env.VERCEL === "1" ||
        Boolean(process.env.NOW_REGION) ||
        Boolean(process.env.VERCEL_REGION);
    if (!isVercelRuntime) return;

    if (!process.env.AWS_EXECUTION_ENV && !process.env.AWS_LAMBDA_JS_RUNTIME) {
        const major = Number.parseInt(process.versions.node.split(".")[0] ?? "20", 10);
        const runtimeVersion = major >= 22 ? "22.x" : "20.x";
        process.env.AWS_EXECUTION_ENV = `AWS_Lambda_nodejs${runtimeVersion}`;
    }
}

async function invalidateBrokenChromiumCache(): Promise<void> {
    if (process.platform !== "linux") return;

    const binaryPath = "/tmp/chromium";
    if (!existsSync(binaryPath)) return;

    const hasAl2Lib = existsSync("/tmp/al2/lib/libnss3.so");
    const hasAl2023Lib = existsSync("/tmp/al2023/lib/libnss3.so");
    if (hasAl2Lib || hasAl2023Lib) return;

    await unlink(binaryPath).catch(() => null);
}

function buildHeaderTemplate(companyName: string): string {
    return `
<div style="width:100%;font-size:9px;padding:0 8mm;color:#334155;font-family:Helvetica,Arial,sans-serif;">
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #b88a2a;padding-bottom:3px;">
    <span style="font-weight:700;color:#111827;">InovaCortex AI Business MRI</span>
    <span>${escapeHtml(companyName)}</span>
  </div>
</div>`;
}

function buildFooterTemplate(reportId: string): string {
    return `
<div style="width:100%;font-size:9px;padding:0 8mm;color:#64748b;font-family:Helvetica,Arial,sans-serif;">
  <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e2e8f0;padding-top:3px;">
    <span>Report ID: ${escapeHtml(reportId)}</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>
</div>`;
}

function shouldFallback(errorMessage: string): boolean {
    const normalized = errorMessage.toLowerCase();
    return [
        "failed to launch the browser process",
        "error while loading shared libraries",
        "libnss3.so",
        "could not find chrome",
        "spawn enoent",
        "browser was not found",
        "failed to connect to the browser",
        "an `executablepath` or `channel` must be specified",
        "unable to launch browser for pdf generation",
    ].some((pattern) => normalized.includes(pattern));
}

function buildTextFallbackPdfBuffer(input: GeneratePdfInput, browserError: string): Buffer {
    const lines = [
        "InovaCortex AI Business MRI",
        `Empresa: ${input.companyName}`,
        `Report ID: ${input.reportId}`,
        `Gerado em: ${new Date().toISOString()}`,
        "Modo de resiliencia ativado por indisponibilidade do Chromium.",
        "",
        ...extractTextFromHtml(input.html),
        "",
        "Detalhe tecnico:",
        browserError.slice(0, 220),
    ];
    return buildMinimalPdfFromLines(lines);
}

function extractTextFromHtml(html: string): string[] {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<\/(p|div|h1|h2|h3|li|br|tr|td|th|section|article)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 90);
}

function buildMinimalPdfFromLines(lines: string[]): Buffer {
    const textLines = lines.slice(0, 120);
    const pageSize = 42;
    const pages = Math.max(1, Math.ceil(textLines.length / pageSize));

    const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>"];
    const kidsRefs: string[] = [];
    const pageObjectNumbers: number[] = [];
    const contentObjectNumbers: number[] = [];
    const fontObjectNumber = 3 + pages * 2;

    for (let i = 0; i < pages; i += 1) {
        const pageObj = 3 + i;
        const contentObj = 3 + pages + i;
        pageObjectNumbers.push(pageObj);
        contentObjectNumbers.push(contentObj);
        kidsRefs.push(`${pageObj} 0 R`);
    }
    objects.push(`<< /Type /Pages /Kids [${kidsRefs.join(" ")}] /Count ${pages} >>`);

    for (let i = 0; i < pages; i += 1) {
        const pageObj = pageObjectNumbers[i];
        const contentObj = contentObjectNumbers[i];
        objects[pageObj - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObj} 0 R >>`;
    }

    for (let i = 0; i < pages; i += 1) {
        const chunk = textLines.slice(i * pageSize, (i + 1) * pageSize);
        const contentChunks: string[] = ["BT", "/F1 10 Tf", "44 792 Td"];
        for (let j = 0; j < chunk.length; j += 1) {
            if (j > 0) contentChunks.push("0 -16 Td");
            contentChunks.push(`(${escapePdfText(chunk[j])}) Tj`);
        }
        contentChunks.push("ET");
        const streamContent = contentChunks.join("\n");
        objects[contentObjectNumbers[i] - 1] = `<< /Length ${Buffer.byteLength(streamContent, "utf8")} >>\nstream\n${streamContent}\nendstream`;
    }

    objects[fontObjectNumber - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (let i = 0; i < objects.length; i += 1) {
        offsets.push(Buffer.byteLength(pdf, "utf8"));
        pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (const offset of offsets) {
        pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, "utf8");
}

function escapePdfText(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/\r/g, "")
        .replace(/\n/g, " ");
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
