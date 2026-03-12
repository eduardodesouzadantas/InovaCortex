import chromium from "@sparticuz/chromium";
import puppeteerCore, { type Browser } from "puppeteer-core";

export interface GeneratePdfInput {
    html: string;
    companyName: string;
    reportId: string;
}

export async function generatePdfFromHtml(input: GeneratePdfInput): Promise<Buffer> {
    const { browser, remote } = await launchBrowser();

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1810, deviceScaleFactor: 2 });
        await page.emulateMediaType("screen");
        await page.setContent(input.html, { waitUntil: ["domcontentloaded", "networkidle0"] });
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
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Business MRI PDF generation failed: ${message}`);
    } finally {
        if (remote) {
            (browser as Browser).disconnect();
        } else {
            await browser.close().catch(() => null);
        }
    }
}

async function launchBrowser(): Promise<{ browser: Browser; remote: boolean }> {
    const wsEndpoint = (process.env.PDF_BROWSER_WS_ENDPOINT ?? "").trim();
    if (wsEndpoint) {
        const browser = await puppeteerCore.connect({ browserWSEndpoint: wsEndpoint });
        return { browser, remote: true };
    }

    const launchErrors: string[] = [];

    try {
        const executablePath = await chromium.executablePath();
        const browser = await puppeteerCore.launch({
            executablePath,
            args: [
                ...chromium.args,
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--font-render-hinting=none",
            ],
            defaultViewport: chromium.defaultViewport,
            headless: chromium.headless,
        });
        return { browser, remote: false };
    } catch (error) {
        launchErrors.push(normalizeError(error));
    }

    try {
        const browser = await puppeteerCore.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });
        return { browser, remote: false };
    } catch (error) {
        launchErrors.push(normalizeError(error));
    }

    throw new Error(`Unable to launch browser for PDF generation. Attempts: ${launchErrors.join(" | ")}`);
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
