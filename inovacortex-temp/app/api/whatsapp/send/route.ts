import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMetaCredentials } from "@/lib/security/tokens";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const { assessmentId } = await request.json();

        const assessment = await prisma.assessment.findUnique({
            where: { id: assessmentId },
            include: { artifactReport: true }
        } as any) as any;

        if (!assessment) {
            return NextResponse.json({ error: "Assessment não encontrado" }, { status: 404 });
        }

        if (!assessment.whatsappConsent || !assessment.phone) {
            return NextResponse.json({ error: "Lead sem consentimento ou telefone válido" }, { status: 400 });
        }

        // Load and decrypt Meta credentials from DB (falls back to ENV)
        const creds = await getMetaCredentials();
        const PHONE_ID = creds.phoneNumberId;
        const ACCESS_TOKEN = creds.accessToken;

        if (!PHONE_ID || !ACCESS_TOKEN) {
            logger.warn("WhatsApp credentials missing", { assessmentId });
            await logMessage(assessment.id, "failed", "Missing WhatsApp credentials");
            return NextResponse.json({
                error: "Serviço não configurado. Configure as credenciais em /admin/configuracoes"
            }, { status: 500 });
        }

        // Format Phone (E.164 for Brazil)
        const msisdn = formatPhone(assessment.phone);
        if (!msisdn) {
            logger.warn("Invalid phone number", { assessmentId, phone: assessment.phone });
            await logMessage(assessment.id, "failed", "Número de telefone inválido");
            return NextResponse.json({ error: "Número de telefone inválido" }, { status: 400 });
        }

        const slug = assessment.artifactReport?.publicSlug;
        const payload = buildTemplatePayload(msisdn, assessment, slug);

        const metaRes = await fetch(
            `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        const metaData = await metaRes.json();
        const status = metaRes.ok ? "sent" : "failed";

        await logMessage(assessment.id, status, JSON.stringify({ metaStatus: metaData }));
        await logAudit("whatsapp", assessmentId, status, { phone: msisdn.slice(-4) });

        if (!metaRes.ok) {
            logger.error("Meta API error", { assessmentId, metaData });
            return NextResponse.json({ error: "Falha no envio via Meta API", detail: metaData }, { status: 502 });
        }

        logger.info("WhatsApp message sent", { assessmentId });
        return NextResponse.json({ success: true, messageId: metaData.messages?.[0]?.id });

    } catch (e: any) {
        logger.error("WhatsApp send error", { error: e?.message });
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("0")) return "55" + digits.slice(1);
    if (digits.length === 11) return "55" + digits;
    if (digits.length === 13 && digits.startsWith("55")) return digits;
    if (digits.length === 12 && digits.startsWith("55")) return digits;
    return null;
}

function buildTemplatePayload(to: string, assessment: any, slug?: string) {
    const score = assessment.scoreTotal;
    const classification = assessment.classification;
    const mission = JSON.parse(assessment.recommendedMissions || "[]")[0] ?? "Automação Inteligente";
    const dossierUrl = slug ? `https://inovacortex.com.br/diagnostico/${slug}` : "";

    return {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
            name: "inovacortex_diagnostico",
            language: { code: "pt_BR" },
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: assessment.name },
                        { type: "text", text: `${score}/100` },
                        { type: "text", text: classification },
                        { type: "text", text: mission },
                        { type: "text", text: dossierUrl },
                    ]
                }
            ]
        }
    };
}

async function logMessage(assessmentId: string, status: string, detail: string) {
    try {
        await (prisma as any).messageLog.create({
            data: { assessmentId, provider: "whatsapp_meta", status, payloadRedacted: detail }
        });
    } catch (e) {
        logger.warn("Failed to log message", { assessmentId, status });
    }
}
