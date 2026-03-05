/**
 * app/api/pdf/executive-pack/[id]/route.ts
 * V24: GET — Generate a PDF for an executive pack.
 *
 * Reuses same Puppeteer pattern as /api/pdf/[slug]/route.ts.
 * Navigates to /org/[slug]/admin/executive-pack/preview/[id]?pdf=true
 * and returns the PDF buffer.
 */

import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const { id } = params;
    logger.info("[ExecPack PDF] Generating", { id });

    try {
        const { prisma } = await import("@/lib/prisma");
        const pack = await (prisma as any).execPack.findFirst({
            where: { OR: [{ id }, { publicSlug: id }] },
        });
        if (!pack) return new NextResponse("Pack não encontrado", { status: 404 });

        const payload = JSON.parse(pack.payloadJson);
        const { origin } = new URL(req.url);

        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 900 });

        // Navigate to printable preview page
        const url = `${origin}/admin/executive-pack/preview/${id}?pdf=true`;
        await page.goto(url, { waitUntil: "networkidle0", timeout: 45_000 });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" },
        });

        await browser.close();

        const orgLabel = payload.anonymized ? "Executive_Pack" : `Executive_Pack_${id}`;

        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${orgLabel}.pdf"`,
            },
        });

    } catch (err: any) {
        logger.error("[ExecPack PDF] Error", { id, err: err?.message });
        return new NextResponse("Erro ao gerar PDF", { status: 500 });
    }
}
