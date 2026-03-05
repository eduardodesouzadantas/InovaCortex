import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import puppeteer from "puppeteer";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const resolvedParams = await params;
        const { slug } = resolvedParams;

        // 1. Check if it exists
        const report = await prisma.artifactReport.findUnique({
            where: { publicSlug: slug },
            include: { assessment: true }
        });

        if (!report) {
            return new NextResponse("Dossiê não encontrado", { status: 404 });
        }


        if (report?.assessmentId) {
            await prisma.auditEvent.create({
                data: {
                    assessmentId: report.assessmentId,
                    action: "pdfGenerated",
                    details: JSON.stringify({ triggeredFrom: "download" })
                }
            });
        }

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Para evitar problemas de timeout com Tailwind/recursos locais:
        // Pega a origin da current request para saber onde a aplicação Next.js está rodando
        const { origin } = new URL(request.url);

        // Acessa a página pública do dossiê com a flag pdf=true para esconder os botões
        const dossierUrl = `${origin}/diagnostico/${slug}?pdf=true`;

        await page.goto(dossierUrl, {
            waitUntil: "networkidle0", // Espera até a network acalmar (bom pra fontes e imagens)
            timeout: 30000
        });

        // Configurações do PDF
        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right: "15mm"
            }
        });

        await browser.close();

        // 3. Return the buffer
        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="InovaCortex_Dossie_${report.assessment.company.replace(/[^a-z0-9]/gi, '_')}.pdf"`,
            },
        });

    } catch (error) {
        console.error("[PDF Generation Error]:", error);
        return new NextResponse("Erro ao gerar PDF", { status: 500 });
    }
}
