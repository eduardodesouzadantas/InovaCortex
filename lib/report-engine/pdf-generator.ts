import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import type { Browser } from "puppeteer-core";

export interface GeneratePdfInput {
    html: string;
    companyName: string;
    reportId: string;
}

export async function generatePdfFromHtml(input: GeneratePdfInput): Promise<Buffer> {
    let browser: Browser | null = null;
    let isRemote = false;

    try {
        await preloadFonts();
        const launched = await launchBrowser();
        browser = launched.browser;
        isRemote = launched.remote;

        const page = await browser.newPage();
        await page.emulateMediaType("screen");
        await page.setContent(input.html, { waitUntil: ["domcontentloaded", "networkidle0"] });

        // Ensure web fonts are fully loaded before rendering.
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
        if (shouldUseTextPdfFallback(message)) {
            return buildTextFallbackPdfBuffer(input, message);
        }
        throw new Error(`Business MRI PDF generation failed: ${message}`);
    } finally {
        if (browser) {
            if (isRemote) {
                browser.disconnect();
            } else {
                await browser.close().catch(() => null);
            }
        }
    }
}

async function launchBrowser(): Promise<{ browser: Browser; remote: boolean }> {
    const wsEndpoint = (process.env.PDF_BROWSER_WS_ENDPOINT ?? "").trim();
    if (wsEndpoint.length > 0) {
        const browser = await puppeteerCore.connect({ browserWSEndpoint: wsEndpoint });
        return { browser, remote: true };
    }

    const errors: string[] = [];

    try {
        const executablePath = await resolveExecutablePath();
        const browser = await puppeteerCore.launch({
            args: [
                ...chromium.args,
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--font-render-hinting=none",
                "--single-process",
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
        const browser = await puppeteerCore.launch({
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

    if (configured.length > 0) {
        ensureSharedLibraryPath();
        return configured;
    }

    const executablePath = await chromium.executablePath();
    ensureSharedLibraryPath();
    return executablePath;
}

async function preloadFonts(): Promise<void> {
    const customFont = (process.env.PDF_FONT_REGULAR_URL ?? "").trim();
    if (!customFont) return;

    await chromium.font(customFont).catch(() => null);
}

function ensureSharedLibraryPath(): void {
    const fallbackPaths = ["/tmp/al2/lib", "/tmp/al2023/lib", "/tmp/lib", "/var/task/lib"];
    const existing = (process.env.LD_LIBRARY_PATH ?? "")
        .split(":")
        .map((entry) => entry.trim())
        .filter(Boolean);

    const merged = [...existing];
    for (const path of fallbackPaths) {
        if (!merged.includes(path)) {
            merged.push(path);
        }
    }

    process.env.LD_LIBRARY_PATH = merged.join(":");
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

function shouldUseTextPdfFallback(errorMessage: string): boolean {
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
    const extractedText = extractTextFromHtml(input.html);
    const header = [
        "InovaCortex AI Business MRI",
        `Empresa: ${input.companyName}`,
        `Report ID: ${input.reportId}`,
        `Generated at: ${new Date().toISOString()}`,
        "Rendering mode: resilience fallback",
        "",
    ];
    const details = extractedText.length > 0 ? extractedText : ["Unable to parse report HTML content."];
    const footer = [
        "",
        "Browser rendering failed in runtime:",
        browserError.slice(0, 240),
    ];

    return buildMinimalPdfFromLines([...header, ...details, ...footer]);
}

function extractTextFromHtml(html: string): string[] {
    const plain = html
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
        .filter(Boolean);

    return plain.slice(0, 90);
}

function buildMinimalPdfFromLines(lines: string[]): Buffer {
    const textLines = lines.slice(0, 120);
    const pageSize = 42;
    const pages = Math.max(1, Math.ceil(textLines.length / pageSize));

    const objects: string[] = [];
    objects.push("<< /Type /Catalog /Pages 2 0 R >>");

    const kidsRefs: string[] = [];
    const pageObjectNumbers: number[] = [];
    const contentObjectNumbers: number[] = [];
    const fontObjectNumber = 3 + pages * 2;

    for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
        const pageObjectNumber = 3 + pageIndex;
        const contentObjectNumber = 3 + pages + pageIndex;
        pageObjectNumbers.push(pageObjectNumber);
        contentObjectNumbers.push(contentObjectNumber);
        kidsRefs.push(`${pageObjectNumber} 0 R`);
    }

    objects.push(`<< /Type /Pages /Kids [${kidsRefs.join(" ")}] /Count ${pages} >>`);

    for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
        const pageObjectNumber = pageObjectNumbers[pageIndex];
        const contentObjectNumber = contentObjectNumbers[pageIndex];
        objects[pageObjectNumber - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    }

    for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
        const chunk = textLines.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
        const contentChunks: string[] = ["BT", "/F1 10 Tf", "44 792 Td"];
        for (let index = 0; index < chunk.length; index += 1) {
            if (index > 0) contentChunks.push("0 -16 Td");
            contentChunks.push(`(${escapePdfText(chunk[index])}) Tj`);
        }
        contentChunks.push("ET");
        const streamContent = contentChunks.join("\n");
        const contentObjectNumber = contentObjectNumbers[pageIndex];
        objects[contentObjectNumber - 1] = `<< /Length ${Buffer.byteLength(streamContent, "utf8")} >>\nstream\n${streamContent}\nendstream`;
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
