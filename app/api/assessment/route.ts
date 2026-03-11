/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateScore, AssessmentPayload } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { calculateROI } from "@/lib/roi-engine";
import { checkAssessmentLimit, LimitExceededError } from "@/lib/auth/limits";
import { sendAssessmentDossierWhatsApp } from "@/lib/whatsapp/assessment-send";

// In-memory rate limiting and rudimentary spam protection
const rateLimitMap = new Map<string, { count: number; lastModified: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 min window
const MAX_REQUESTS_PER_WINDOW = 3;

// Zod schema for input validation
const assessmentSchema = z.object({
    name: z.string().trim().min(5),
    email: z.string().trim().email(),
    company: z.string().trim().min(2),
    role: z.string().trim().min(2),
    segment: z.string().trim().min(2),
    teamSize: z.string().min(1),
    volumeDay: z.string().min(1),
    channels: z.array(z.string()).min(1),
    stack: z.array(z.string()),
    pains: z.array(z.string()).min(1),
    urgency: z.string().min(2),
    goal: z.string().min(2),
    phone: z.string().trim().min(10, "WhatsApp inválido"),
    whatsappConsent: z.boolean().default(false), // V3 - Add Consent flag
    honeypot: z.string().optional() // Anti-spam
});

export async function POST(request: Request) {
    try {
        // Basic IP tracking for rate limiting
        // Note: get('x-forwarded-for') is a common header for client IP when behind proxies.
        // If not present, we fall back to a generic identifier in this V1.
        const ip = request.headers.get("x-forwarded-for") || "unknown-ip";

        const now = Date.now();
        const windowStart = now - RATE_LIMIT_WINDOW_MS;

        // Clean up old entries
        for (const [key, value] of Array.from(rateLimitMap.entries())) {
            if (value.lastModified < windowStart) {
                rateLimitMap.delete(key);
            }
        }

        // Rate limit check
        const rateData = rateLimitMap.get(ip) || { count: 0, lastModified: now };
        if (rateData.count >= MAX_REQUESTS_PER_WINDOW && rateData.lastModified > windowStart) {
            return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
        }
        rateData.count++;
        rateData.lastModified = now;
        rateLimitMap.set(ip, rateData);

        const body = await request.json();

        // Resolve organization from ?org query param; fallback to default slug only when not provided.
        const { searchParams } = new URL(request.url);
        const requestedOrgSlug = (searchParams.get("org") || "").trim();
        const resolvedOrgSlug = requestedOrgSlug || "inovacortex";
        const org = await (prisma as any).organization.findUnique({
            where: { slug: resolvedOrgSlug },
        });
        if (!org) {
            return NextResponse.json(
                { error: requestedOrgSlug ? "Invalid organization" : "Default organization not configured" },
                { status: requestedOrgSlug ? 400 : 500 }
            );
        }
        const organizationId: string = org.id;
        const maxPerMonth: number = org.maxAssessmentsPerMonth;

        // 1. Billing limit check (before validation to fail fast)
        await checkAssessmentLimit(organizationId, maxPerMonth);

        // 2. Validate Input
        const validatedData = assessmentSchema.parse(body);

        // 2. Honeypot check
        if (validatedData.honeypot && validatedData.honeypot.length > 0) {
            // It's a bot filing out hidden fields
            return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
        }

        // 3. Calculate Score
        const payload: AssessmentPayload = {
            name: validatedData.name,
            email: validatedData.email,
            company: validatedData.company,
            role: validatedData.role,
            segment: validatedData.segment,
            teamSize: validatedData.teamSize,
            volumeDay: validatedData.volumeDay,
            channels: validatedData.channels,
            stack: validatedData.stack,
            pains: validatedData.pains,
            urgency: validatedData.urgency,
            goal: validatedData.goal,
        };

        const scoreResult = calculateScore(payload);

        // --- Generate Artifact Report Content ---
        const publicSlug = crypto.randomUUID();

        const risks = [
            "LGPD e conformidade na manipulação de dados de clientes",
            "Segurança no acesso a sistemas legados",
            "Dependências de APIs de terceiros e limites de rate"
        ];

        const questions = [
            `Considerando que o time de ${payload.teamSize} usa ${payload.channels.join(", ")}, qual a maior dificuldade em centralizar a operação?`,
            `Vocês já tentaram resolver a dor "${payload.pains[0] || 'mencionada'}" no passado? O que impediu o sucesso?`,
            `Com o foco em "${payload.goal}", vocês têm processos padronizados que uma IA poderia seguir?`
        ];

        const blueprint = {
            modules: ["Automação de Triagem", "Agente de Resolução", "Integração CRM/ERP", "Dashboard de Métricas"],
            integrations: payload.stack && payload.stack.length > 0 ? payload.stack : ["CRM/ERP padrão", "Plataforma de Mensageria API"]
        };

        const roadmap = [
            { phase: "Semana 1", title: "Setup Inicial e Mapeamento", description: "Configuração de ambiente, acessos e integrações básicas." },
            { phase: "Semana 2-3", title: "Desenvolvimento de Agentes", description: "Treinamento, fluxos conversacionais e testes controlados." },
            { phase: "Semana 4", title: "Mission Control e Ajustes", description: "Lançamento supervisionado, métricas em tempo real e passagem de conhecimento." }
        ];

        const assessmentData = {
            organizationId,  // V9: tenant isolation
            name: payload.name,
            email: payload.email,
            company: payload.company,
            role: payload.role,
            segment: payload.segment,
            teamSize: payload.teamSize,
            volumeDay: payload.volumeDay,
            channels: JSON.stringify(payload.channels),
            stack: JSON.stringify(payload.stack),
            pains: JSON.stringify(payload.pains),
            urgency: payload.urgency,
            goal: payload.goal,
            phone: validatedData.phone,
            whatsappConsent: validatedData.whatsappConsent,
            scoreTotal: scoreResult.scoreTotal,
            scoreBreakdown: JSON.stringify(scoreResult.scoreBreakdown),
            classification: scoreResult.classification,
            recommendedMissions: JSON.stringify(scoreResult.recommendedMissions)
        };

        const dossierContent = {
            roadmap,
            risks,
            questions,
            blueprint
        };

        // 4. Save to DB with Audit Trail
        const assessment = await prisma.$transaction(async (tx) => {
            const newAssessment = await (tx as any).assessment.create({
                data: {
                    ...assessmentData,
                    artifactReport: {
                        create: {
                            contentJson: JSON.stringify(dossierContent),
                            publicSlug
                        }
                    }
                },
                include: {
                    artifactReport: true
                }
            });

            await (tx as any).auditEvent.create({
                data: {
                    assessmentId: newAssessment.id,
                    action: "created",
                    details: JSON.stringify({ source: "wizard", version: "v4" })
                }
            });

            // V7: Auto-generate ROI Projection
            const roiInput = {
                teamSize: payload.teamSize,
                volumeDay: payload.volumeDay,
                scoreTotal: scoreResult.scoreTotal,
                classification: scoreResult.classification,
                pains: payload.pains,
            };
            const roi = calculateROI(roiInput);
            await (tx as any).roiProjection.create({
                data: {
                    assessmentId: newAssessment.id,
                    operationalSavingsEstimate: roi.operationalSavingsEstimate,
                    revenueIncreaseEstimate: roi.revenueIncreaseEstimate,
                    monthlyHoursRecovered: roi.monthlyHoursRecovered,
                    estimatedPaybackMonths: roi.estimatedPaybackMonths,
                    confidenceLevel: roi.confidenceLevel,
                }
            });

            await (tx as any).auditEvent.create({
                data: {
                    assessmentId: newAssessment.id,
                    action: "roiGenerated",
                    details: JSON.stringify({
                        savings: roi.operationalSavingsEstimate,
                        revenue: roi.revenueIncreaseEstimate,
                        payback: roi.estimatedPaybackMonths,
                        confidence: roi.confidenceLevel,
                    })
                }
            });

            return newAssessment;
        });

        // 4.5. Trigger WhatsApp Loop V3 (async, non-blocking)
        if (assessment.whatsappConsent && assessment.phone) {
            // Note: Em produção real isso deve ir pra uma Queue/Worker. 
            // Para V3, chamamos diretamente o helper para evitar acoplamento com rota legacy.
            void sendAssessmentDossierWhatsApp({ assessmentId: assessment.id });
        }

        // 5. Response
        return NextResponse.json({
            success: true,
            id: assessment.id,
            scoreTotal: scoreResult.scoreTotal,
            scoreBreakdown: scoreResult.scoreBreakdown,
            classification: scoreResult.classification,
            recommendedMissions: scoreResult.recommendedMissions,
            dossierSlug: publicSlug
        });

    } catch (error) {
        if (error instanceof LimitExceededError) {
            return NextResponse.json({ error: "Limite mensal de avaliações atingido", limit: error.limit }, { status: 429 });
        }
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation failed", details: (error as any).issues }, { status: 400 });
        }
        console.error("[Assesment POST API Error]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
