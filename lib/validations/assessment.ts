import { z } from "zod";

export const assessmentSchema = z.object({
    name: z.string().trim().min(5, "Nome curto demais"),
    email: z.string().trim().email("E-mail inválido"),
    company: z.string().trim().min(2, "Obrigatório"),
    role: z.string().trim().min(2, "Obrigatório"),
    phone: z.string().trim().min(10, "WhatsApp inválido"),
    whatsappConsent: z.boolean().default(false),

    // Elementos de contexto da empresa
    segment: z.string().trim().min(2, "Obrigatório"),
    city: z.string().trim().min(2, "Obrigatório"),
    monthlyRevenue: z.string().min(1, "Selecione o faturamento"),
    teamSize: z.string().min(1, "Selecione o tamanho"),
    customerVolume: z.string().min(1, "Selecione o volume"),

    // Lead Acquisition
    channels: z.array(z.string()).min(1, "Selecione pelo menos um canal"),
    monthlyLeads: z.string().min(1, "Selecione o volume de leads"),
    conversionRate: z.string().min(1, "Selecione a conversão"),
    responseTime: z.string().min(1, "Selecione o tempo de resposta"),

    // Operations
    manualTasks: z.string().min(2, "Descreva as tarefas manuais"),
    hoursLost: z.string().min(1, "Selecione as horas perdidas"),
    crmUsage: z.string().min(1, "Selecione o uso de CRM"),
    automationLevel: z.string().min(1, "Selecione o nível de automação"),

    stack: z.array(z.string()),

    pains: z.array(z.string()).min(1, "Selecione pelo menos uma dor"),
    urgency: z.string().min(1, "Selecione a urgência"),
    goal: z.string().min(1, "Obrigatório"),

    honeypot: z.string().optional()
});

export type AssessmentFormData = z.infer<typeof assessmentSchema>;
