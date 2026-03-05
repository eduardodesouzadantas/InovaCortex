import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Knowledge Ingestion Pipeline (V33)
 * Collects and transforms system data into KnowledgeDocuments and KnowledgeChunks.
 */
export async function ingestOrgKnowledge(orgId: string) {
    logger.info(`Starting Knowledge Ingestion for Org: ${orgId}`);

    try {
        // 1. Fetch Source Data
        const [
            assessments,
            proposals,
            performances,
            leaks,
            insights,
            events,
            outbound
        ] = await Promise.all([
            prisma.assessment.findMany({ where: { organizationId: orgId } }),
            prisma.proposal.findMany({ where: { assessment: { organizationId: orgId } } }),
            (prisma as any).meetingPerformance.findMany({ where: { organizationId: orgId } }),
            (prisma as any).profitLeak.findMany({ where: { organizationId: orgId } }),
            (prisma as any).strategicInsight.findMany({ where: { organizationId: orgId } }),
            (prisma as any).systemEvent.findMany({ where: { organizationId: orgId }, take: 50, orderBy: { createdAt: 'desc' } }),
            (prisma as any).outboundMessage.findMany({ where: { orgId, status: 'sent' } })
        ]);

        // 2. Transform into Documents
        const documents: any[] = [];

        // Assessments Ingestion
        assessments.forEach(a => {
            documents.push({
                sourceType: 'assessment',
                sourceId: a.id,
                title: `Assessment: ${a.company} - ${a.name}`,
                rawText: `Lead: ${a.name}\nEmpresa: ${a.company}\nSetor: ${a.segment}\nDores: ${a.pains}\nObjetivo: ${a.goal}\nScore: ${a.classification}`,
                metadataJson: { classification: a.classification, score: a.scoreTotal }
            });
        });

        // Proposals Ingestion
        proposals.forEach(p => {
            documents.push({
                sourceType: 'proposal',
                sourceId: p.id,
                title: `Proposal ${p.id.slice(0, 8)} - Status: ${p.status}`,
                rawText: `Status: ${p.status}\nNotas: ${p.customNotes}\nROI: ${p.roiSnapshot}\nPreço: ${p.pricingEstimate}`,
                metadataJson: { status: p.status }
            });
        });

        // Meeting Performances Ingestion
        performances.forEach((p: any) => {
            documents.push({
                sourceType: 'meeting',
                sourceId: p.id,
                title: `Meeting Outcome: ${p.outcome}`,
                rawText: `Resultado: ${p.outcome}\nNotas: ${p.notes}\nValor Fechado: R$ ${p.closedValue / 100}`,
                metadataJson: { outcome: p.outcome, value: p.closedValue }
            });
        });

        // Profit Leaks Ingestion
        leaks.forEach((l: any) => {
            documents.push({
                sourceType: 'profit_leak',
                sourceId: l.id,
                title: l.title,
                rawText: `${l.description}\nPerda Estimada: R$ ${l.estimatedLossCents / 100}\nCategoria: ${l.category}`,
                metadataJson: { severity: l.severity, category: l.category }
            });
        });

        // Strategic Insights Ingestion
        insights.forEach((i: any) => {
            documents.push({
                sourceType: 'strategic_insight',
                sourceId: i.id,
                title: i.title,
                rawText: `${i.category.toUpperCase()}: ${i.description}\nRecomendação: ${i.recommendedAction}`,
                metadataJson: { impactScore: i.impactScore, category: i.category }
            });
        });

        // System Events Ingestion (Focus on relevant high-level events)
        events.forEach((e: any) => {
            documents.push({
                sourceType: 'system_event',
                sourceId: e.id,
                title: `Event: ${e.type}`,
                rawText: `Ocorrência: ${e.type}\nPayload: ${e.payloadJson}\nData: ${e.createdAt.toISOString()}`,
                metadataJson: { type: e.type, entityType: e.entityType }
            });
        });

        // Outbound Messages Ingestion
        outbound.forEach((m: any) => {
            documents.push({
                sourceType: 'outbound',
                sourceId: m.id,
                title: `Outbound Message to ${m.prospectId}`,
                rawText: `Corpo da Mensagem: ${m.body}\nTemplate: ${m.templateKey}\nEnviada em: ${m.sentAt?.toISOString()}`,
                metadataJson: { template: m.templateKey }
            });
        });

        // 3. Upsert Documents and Create Chunks
        let processedCount = 0;
        for (const doc of documents) {
            // Upsert KnowledgeDocument (Idempotent by orgId + sourceType + sourceId)
            const kDoc = await (prisma as any).knowledgeDocument.upsert({
                where: {
                    organizationId_sourceType_sourceId: {
                        organizationId: orgId,
                        sourceType: doc.sourceType,
                        sourceId: doc.sourceId
                    }
                },
                update: {
                    title: doc.title,
                    rawText: doc.rawText,
                    metadataJson: doc.metadataJson,
                    updatedAt: new Date()
                },
                create: {
                    organizationId: orgId,
                    sourceType: doc.sourceType,
                    sourceId: doc.sourceId,
                    title: doc.title,
                    rawText: doc.rawText,
                    metadataJson: doc.metadataJson
                }
            });

            // 4. Simple Chunking (700-900 chars)
            const chunks = chunkText(doc.rawText, 800, 100);

            // Delete old chunks
            await (prisma as any).knowledgeChunk.deleteMany({ where: { documentId: kDoc.id } });

            // Create new chunks
            await (prisma as any).knowledgeChunk.createMany({
                data: chunks.map((text, index) => {
                    const { getChunkHash } = require("./embeddings");
                    return {
                        organizationId: orgId,
                        documentId: kDoc.id,
                        chunkIndex: index,
                        chunkText: text,
                        chunkHash: getChunkHash(text),
                        tokenCount: Math.ceil(text.length / 4)
                    };
                })
            });

            processedCount++;
        }

        logger.info(`Ingestion complete: ${processedCount} documents processed for org: ${orgId}`);
        return { success: true, processedCount };

    } catch (error: any) {
        logger.error(`Knowledge Ingestion Error: ${error.message}`);
        throw error;
    }
}

/**
 * Splits text into overlapping chunks.
 */
function chunkText(text: string, size: number, overlap: number): string[] {
    const chunks: string[] = [];
    if (!text) return chunks;

    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + size, text.length);
        chunks.push(text.slice(start, end));
        start += (size - overlap);
        if (start >= text.length) break;
    }
    return chunks;
}
