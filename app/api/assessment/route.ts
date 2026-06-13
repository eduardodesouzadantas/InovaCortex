import { withApiLogging } from "@/lib/logger";
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateScore } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { calculateROI } from "@/lib/roi-engine";
import { checkAssessmentLimit, LimitExceededError } from "@/lib/auth/limits";
import { sendAssessmentDossierWhatsApp } from "@/lib/whatsapp/assessment-send";
import { ensureAssessmentCommercialFlow } from "@/lib/commercial/canonical-flow";

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
    phone: z.string().trim().min(10, "WhatsApp inválido"),
    whatsappConsent: z.boolean().default(false), // V3 - Add Consent flag
    
    // Elementos de contexto da empresa
    segment: z.string().trim().min(2),
    city: z.string().trim().min(2),
    monthlyRevenue: z.string().min(1),
    teamSize: z.string().min(1),
    customerVolume: z.string().min(1),

    // Lead Acquisition
    channels: z.array(z.string()).min(1),
    monthlyLeads: z.string().min(1),
    conversionRate: z.string().min(1),
    responseTime: z.string().min(1),

    // Operations
    manualTasks: z.string().min(2),
    hoursLost: z.string().min(1),
    crmUsage: z.string().min(1),
    automationLevel: z.string().min(1),

    stack: z.array(z.string()),

    pains: z.array(z.string()).min(1),
    urgency: z.string().min(1),
    goal: z.string().min(1),

    honeypot: z.string().optional() // Anti-spam
});

async function POSTHandler(request: Request) {
    try {
        // Basic IP tracking for rate limiting
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
        const payload: any = {
            name: validatedData.name,
            email: validatedData.email,
            company: validatedData.company,
            role: validatedData.role,
            segment: validatedData.segment,
            city: validatedData.city,
            monthlyRevenue: validatedData.monthlyRevenue,
            teamSize: validatedData.teamSize,
            customerVolume: validatedData.customerVolume,
            channels: validatedData.channels,
            monthlyLeads: validatedData.monthlyLeads,
            conversionRate: validatedData.conversionRate,
            responseTime: validatedData.responseTime,
            manualTasks: validatedData.manualTasks,
            hoursLost: validatedData.hoursLost,
            crmUsage: validatedData.crmUsage,
            automationLevel: validatedData.automationLevel,
            stack: validatedData.stack,
            pains: validatedData.pains,
            urgency: validatedData.urgency,
            goal: validatedData.goal,
        };

        const scoreResult = (calculateScore as any)(payload);

        // --- Generate Artifact Report Content ---
        const publicSlug = crypto.randomUUID();
        const pStr = JSON.stringify(payload).toLowerCase();

        // Dynamic Risks based on stack/pains
        const risks = [];
        if (pStr.includes("sap") || pStr.includes("totvs") || pStr.includes("erp") || pStr.includes("bling")) {
            risks.push("Limitações de API e gargalos de integração no ERP atual");
        }
        if (payload.channels.includes("WhatsApp") || payload.channels.includes("Instagram")) {
            risks.push("Risco de bloqueio de contas por automações não oficiais na Meta");
            risks.push("Desconexão dos canais de mensagem com o CRM, gerando perda de histórico");
        } else {
            risks.push("Falta de canais de aquisição instantânea (WhatsApp/Insta) estruturados");
        }
        if (pStr.includes("tempo") || pStr.includes("manual") || pStr.includes("mais de 5h")) {
            risks.push("Dependência crítica de capital humano para tarefas repetitivas (Single point of failure)");
        }
        if (risks.length < 3) risks.push("Falta de visibilidade centralizada (Dashboard unificado) da operação");

        // Dynamic Questions
        const questions = [
            `Seu time perde ${payload.hoursLost || "várias horas"} diariamente apenas em trabalho manual. Qual o real impacto financeiro disso na ${payload.company}?`,
            `Com a taxa de conversão atual (${payload.conversionRate || "desconhecida"}), quanto faturamento vocês estimam deixar na mesa todo mês?`,
            `Considerando o objetivo de "${payload.goal}", vocês possuem os processos de atendimento documentados para treinar uma Inteligência Artificial?`
        ];

        // Dynamic Blueprint Modules
        const modules = ["Plataforma Central de Inteligência InovaCortex"];
        if (payload.channels.includes("WhatsApp")) modules.push("Agente Conversacional L1 (Integração Meta)");
        if (pStr.includes("crm") || pStr.includes("rd") || pStr.includes("hubspot")) modules.push("Orquestrador Bidirecional (CRM <-> InovaCortex)");
        if (pStr.includes("erp") || pStr.includes("sap")) modules.push("Gateway de Integração de Sistemas (Consultas seguras ERP)");
        if (pStr.includes("manual") || pStr.includes("planilha")) modules.push("Automação de Backoffice (RPA Background)");
        if (modules.length === 1) modules.push("Agent Assist (Co-piloto humano)", "Dashboard Analytics in Real-Time");

        const blueprint = {
            modules: modules.slice(0, 4),
            integrations: payload.stack && payload.stack.length > 0 
                ? payload.stack 
                : ["WhatsApp Cloud API", "Make/n8n", "InovaCortex Engine"]
        };

        // Dynamic Roadmap
        const roadmap = [
            { phase: "Semana 1", title: "Mapeamento & Infraestrutura", description: `Análise dos fluxos da ${payload.company} e auditoria de acessos aos sistemas (${payload.stack.slice(0,2).join(", ") || "Ferramentas base"}).` },
            { phase: "Semana 2", title: "Setup do Tenant", description: "Configuração da instância InovaCortex e conexão segura com os canais autorizados." },
        ];
        
        if (scoreResult.classification === "Alta prioridade" || pStr.includes("avançada")) {
            roadmap.push({ phase: "Semana 3-4", title: "Implantação Avançada", description: "Treinamento do Agente IA com base de conhecimento proprietária e ativação de integrações profundas." });
        } else {
            roadmap.push({ phase: "Semana 3", title: "Desenvolvimento do Piloto", description: "Criação do primeiro Agente Conversacional focado na principal dor mapeada." });
            roadmap.push({ phase: "Semana 4", title: "Go-Live Controlado", description: "Início da operação híbrida (IA + Equipe) com monitoramento em tempo real (Shadow Mode)." });
        }

        const assessmentData = {
            organizationId,  // V9: tenant isolation
            name: payload.name,
            email: payload.email,
            company: payload.company,
            role: payload.role,
            segment: payload.segment,
            teamSize: payload.teamSize,
            volumeDay: payload.customerVolume, // Map to existing col
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
            recommendedMissions: JSON.stringify(scoreResult.recommendedMissions),
            internalNotes: JSON.stringify({ // Safe schema-less packing
                city: payload.city,
                monthlyRevenue: payload.monthlyRevenue,
                monthlyLeads: payload.monthlyLeads,
                conversionRate: payload.conversionRate,
                responseTime: payload.responseTime,
                manualTasks: payload.manualTasks,
                hoursLost: payload.hoursLost,
                crmUsage: payload.crmUsage,
                automationLevel: payload.automationLevel
            })
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
                volumeDay: payload.customerVolume,
                monthlyRevenue: payload.monthlyRevenue,
                hoursLost: payload.hoursLost,
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

            await ensureAssessmentCommercialFlow({
                assessmentId: newAssessment.id,
                source: "assessment",
                db: tx as any,
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
        throw error;
    }
}

export const POST = withApiLogging("/api/assessment", "POST", POSTHandler);
