import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";

export interface GeneratePdfInput {
    html: string;
    companyName: string;
    reportId: string;
}

export async function generatePdfFromHtml(input: GeneratePdfInput): Promise<Buffer> {
    await preloadFonts();
    const executablePath = await resolveExecutablePath();

    const browser = await puppeteerCore.launch({
        args: [
            ...chromium.args,
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--font-render-hinting=none",
        ],
        executablePath,
        headless: chromium.headless,
        defaultViewport: chromium.defaultViewport ?? {
            width: 1280,
            height: 1810,
            deviceScaleFactor: 2,
        },
    });

    try {
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
    } finally {
        await browser.close().catch(() => null);
    }
}

async function resolveExecutablePath(): Promise<string> {
    const configured =
        (process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROMIUM_EXECUTABLE_PATH ?? "").trim();

    if (configured.length > 0) {
        return configured;
    }

    return chromium.executablePath();
}

async function preloadFonts(): Promise<void> {
    const customFont = (process.env.PDF_FONT_REGULAR_URL ?? "").trim();
    if (!customFont) return;

    await chromium.font(customFont).catch(() => null);
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
