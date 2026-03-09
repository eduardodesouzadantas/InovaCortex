import { prisma } from "@/lib/prisma";
import { sendWhatsAppTemplateForOrg } from "@/lib/whatsapp/meta-client";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

type SendAssessmentWhatsAppInput = {
    assessmentId: string;
    expectedOrganizationId?: string;
};

type SendAssessmentWhatsAppResult =
    | { ok: true; status: 200; messageId: string | null }
    | { ok: false; status: 400 | 404 | 409 | 422 | 502 | 503 | 500; error: string; details?: unknown };

type AssessmentRecord = {
    id: string;
    organizationId: string;
    name: string;
    scoreTotal: number;
    classification: string;
    phone: string;
    whatsappConsent: boolean;
    recommendedMissions: string | null;
    artifactReport: { publicSlug: string } | null;
};

function formatPhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("0")) return "55" + digits.slice(1);
    if (digits.length === 11) return "55" + digits;
    if (digits.length === 13 && digits.startsWith("55")) return digits;
    if (digits.length === 12 && digits.startsWith("55")) return digits;
    return null;
}

function safeMission(recommendedMissions: string | null): string {
    try {
        const parsed = JSON.parse(recommendedMissions || "[]");
        return Array.isArray(parsed) && typeof parsed[0] === "string"
            ? parsed[0]
            : "Automacao Inteligente";
    } catch {
        return "Automacao Inteligente";
    }
}

function buildTemplateComponents(assessment: AssessmentRecord): Array<Record<string, unknown>> {
    const mission = safeMission(assessment.recommendedMissions);
    const dossierUrl = assessment.artifactReport?.publicSlug
        ? `https://inovacortex.com.br/diagnostico/${assessment.artifactReport.publicSlug}`
        : "";

    return [
        {
            type: "body",
            parameters: [
                { type: "text", text: assessment.name },
                { type: "text", text: `${assessment.scoreTotal}/100` },
                { type: "text", text: assessment.classification },
                { type: "text", text: mission },
                { type: "text", text: dossierUrl },
            ],
        },
    ];
}

async function logMessage(assessmentId: string, status: string, payloadRedacted: string) {
    try {
        await prisma.messageLog.create({
            data: { assessmentId, provider: "whatsapp_meta", status, payloadRedacted },
        });
    } catch {
        logger.warn("Failed to log WhatsApp message", { assessmentId, status });
    }
}

export async function sendAssessmentDossierWhatsApp(
    input: SendAssessmentWhatsAppInput,
): Promise<SendAssessmentWhatsAppResult> {
    try {
        const where = input.expectedOrganizationId
            ? { id: input.assessmentId, organizationId: input.expectedOrganizationId }
            : { id: input.assessmentId };

        const assessment = await prisma.assessment.findFirst({
            where,
            select: {
                id: true,
                organizationId: true,
                name: true,
                scoreTotal: true,
                classification: true,
                phone: true,
                whatsappConsent: true,
                recommendedMissions: true,
                artifactReport: {
                    select: { publicSlug: true },
                },
            },
        });

        if (!assessment) {
            return { ok: false, status: 404, error: "Assessment nao encontrado" };
        }

        if (!assessment.whatsappConsent || !assessment.phone) {
            return { ok: false, status: 422, error: "Lead sem consentimento ou telefone valido" };
        }

        const msisdn = formatPhone(assessment.phone);
        if (!msisdn) {
            await logMessage(assessment.id, "failed", "Numero de telefone invalido");
            return { ok: false, status: 400, error: "Numero de telefone invalido" };
        }

        const components = buildTemplateComponents(assessment as AssessmentRecord);
        const result = await sendWhatsAppTemplateForOrg(
            assessment.organizationId,
            msisdn,
            "inovacortex_diagnostico",
            "pt_BR",
            components,
        );

        if (!result.messageId) {
            const status = result.error === "META_NOT_CONFIGURED" ? 503 : 502;
            await logMessage(assessment.id, "failed", result.error ?? "META_SEND_FAILED");
            await logAudit("whatsapp", assessment.id, "failed", {
                organizationId: assessment.organizationId,
                reason: result.error ?? "META_SEND_FAILED",
            });
            return {
                ok: false,
                status,
                error: status === 503
                    ? "Servico nao configurado. Configure credenciais Meta."
                    : "Falha no envio via Meta API",
                details: result.error,
            };
        }

        await logMessage(assessment.id, "sent", JSON.stringify({ messageId: result.messageId }));
        await logAudit("whatsapp", assessment.id, "sent", {
            organizationId: assessment.organizationId,
            phoneTail: msisdn.slice(-4),
        });

        return { ok: true, status: 200, messageId: result.messageId };
    } catch (error) {
        logger.error("Failed to send assessment dossier via WhatsApp", {
            assessmentId: input.assessmentId,
            error: error instanceof Error ? error.message : String(error),
        });
        return { ok: false, status: 500, error: "Erro interno" };
    }
}
