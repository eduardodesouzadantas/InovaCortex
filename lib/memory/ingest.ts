import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getChunkHash } from "./embeddings";

type KnowledgeDocumentInput = {
    sourceType: string;
    sourceId: string;
    title: string;
    rawText: string;
    metadataJson: string;
};

function stringifyMetadata(value: Record<string, unknown>): string {
    return JSON.stringify(value);
}

function chunkText(text: string, size: number, overlap: number): string[] {
    const chunks: string[] = [];
    if (!text) return chunks;

    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + size, text.length);
        chunks.push(text.slice(start, end));
        start += size - overlap;
        if (start >= text.length) break;
    }

    return chunks;
}

export async function ingestOrgKnowledge(orgId: string) {
    logger.info(`Starting Knowledge Ingestion for Org: ${orgId}`);

    try {
        const [
            assessments,
            proposals,
            performances,
            leaks,
            insights,
            events,
            outbound,
        ] = await Promise.all([
            prisma.assessment.findMany({ where: { organizationId: orgId } }),
            prisma.proposal.findMany({ where: { assessment: { organizationId: orgId } } }),
            prisma.meetingPerformance.findMany({ where: { organizationId: orgId } }),
            prisma.profitLeak.findMany({ where: { orgId } }),
            prisma.strategicInsight.findMany({ where: { organizationId: orgId } }),
            prisma.systemEvent.findMany({
                where: { organizationId: orgId },
                take: 50,
                orderBy: { createdAt: "desc" },
            }),
            prisma.outboundMessage.findMany({ where: { orgId, status: "sent" } }),
        ]);

        const documents: KnowledgeDocumentInput[] = [];

        for (const assessment of assessments) {
            documents.push({
                sourceType: "assessment",
                sourceId: assessment.id,
                title: `Assessment: ${assessment.company} - ${assessment.name}`,
                rawText: [
                    `Lead: ${assessment.name}`,
                    `Empresa: ${assessment.company}`,
                    `Setor: ${assessment.segment}`,
                    `Dores: ${assessment.pains}`,
                    `Objetivo: ${assessment.goal}`,
                    `Score: ${assessment.classification}`,
                ].join("\n"),
                metadataJson: stringifyMetadata({
                    classification: assessment.classification,
                    score: assessment.scoreTotal,
                }),
            });
        }

        for (const proposal of proposals) {
            documents.push({
                sourceType: "proposal",
                sourceId: proposal.id,
                title: `Proposal ${proposal.id.slice(0, 8)} - Status: ${proposal.status}`,
                rawText: [
                    `Status: ${proposal.status}`,
                    `Notas: ${proposal.customNotes}`,
                    `ROI: ${proposal.roiSnapshot}`,
                    `Preco: ${proposal.pricingEstimate}`,
                ].join("\n"),
                metadataJson: stringifyMetadata({ status: proposal.status }),
            });
        }

        for (const performance of performances) {
            documents.push({
                sourceType: "meeting",
                sourceId: performance.id,
                title: `Meeting Outcome: ${performance.outcome}`,
                rawText: [
                    `Resultado: ${performance.outcome}`,
                    `Notas: ${performance.notes ?? ""}`,
                    `Valor Fechado: R$ ${performance.closedValue / 100}`,
                ].join("\n"),
                metadataJson: stringifyMetadata({
                    outcome: performance.outcome,
                    value: performance.closedValue,
                }),
            });
        }

        for (const leak of leaks) {
            documents.push({
                sourceType: "profit_leak",
                sourceId: leak.id,
                title: leak.title,
                rawText: [
                    leak.description,
                    `Perda Estimada: R$ ${leak.estimatedLossCents / 100}`,
                    `Categoria: ${leak.kind}`,
                ].join("\n"),
                metadataJson: stringifyMetadata({
                    severity: leak.severity,
                    category: leak.kind,
                }),
            });
        }

        for (const insight of insights) {
            documents.push({
                sourceType: "strategic_insight",
                sourceId: insight.id,
                title: insight.title,
                rawText: `${insight.category.toUpperCase()}: ${insight.description}\nRecomendacao: ${insight.recommendedAction}`,
                metadataJson: stringifyMetadata({
                    impactScore: insight.impactScore,
                    category: insight.category,
                }),
            });
        }

        for (const event of events) {
            documents.push({
                sourceType: "system_event",
                sourceId: event.id,
                title: `Event: ${event.type}`,
                rawText: [
                    `Ocorrencia: ${event.type}`,
                    `Payload: ${event.payloadJson}`,
                    `Data: ${event.createdAt.toISOString()}`,
                ].join("\n"),
                metadataJson: stringifyMetadata({
                    type: event.type,
                    entityType: event.entityType,
                }),
            });
        }

        for (const message of outbound) {
            documents.push({
                sourceType: "outbound",
                sourceId: message.id,
                title: `Outbound Message to ${message.prospectId}`,
                rawText: [
                    `Corpo da Mensagem: ${message.body}`,
                    `Template: ${message.templateKey ?? ""}`,
                    `Enviada em: ${message.sentAt?.toISOString() ?? ""}`,
                ].join("\n"),
                metadataJson: stringifyMetadata({ template: message.templateKey }),
            });
        }

        let processedCount = 0;

        for (const document of documents) {
            const knowledgeDocument = await prisma.knowledgeDocument.upsert({
                where: {
                    organizationId_sourceType_sourceId: {
                        organizationId: orgId,
                        sourceType: document.sourceType,
                        sourceId: document.sourceId,
                    },
                },
                update: {
                    title: document.title,
                    rawText: document.rawText,
                    metadataJson: document.metadataJson,
                    updatedAt: new Date(),
                },
                create: {
                    organizationId: orgId,
                    sourceType: document.sourceType,
                    sourceId: document.sourceId,
                    title: document.title,
                    rawText: document.rawText,
                    metadataJson: document.metadataJson,
                },
            });

            const chunks = chunkText(document.rawText, 800, 100);

            await prisma.knowledgeChunk.deleteMany({
                where: { documentId: knowledgeDocument.id },
            });

            await prisma.knowledgeChunk.createMany({
                data: chunks.map((text, index) => ({
                    organizationId: orgId,
                    documentId: knowledgeDocument.id,
                    chunkIndex: index,
                    chunkText: text,
                    chunkHash: getChunkHash(text),
                    tokenCount: Math.ceil(text.length / 4),
                })),
            });

            processedCount += 1;
        }

        logger.info(`Ingestion complete: ${processedCount} documents processed for org: ${orgId}`);
        return { success: true, processedCount };
    } catch (error: unknown) {
        logger.error("Knowledge Ingestion Error", {
            orgId,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
