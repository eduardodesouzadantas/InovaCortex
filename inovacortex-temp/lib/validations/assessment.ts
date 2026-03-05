import { z } from "zod";

export const assessmentSchema = z.object({
    name: z.string().trim().min(5, "Nome curto demais"),
    email: z.string().trim().email("E-mail inválido"),
    company: z.string().trim().min(2, "Obrigatório"),
    role: z.string().trim().min(2, "Obrigatório"),
    phone: z.string().trim().min(10, "WhatsApp inválido"),
    whatsappConsent: z.boolean().default(false),

    segment: z.string().trim().min(2, "Obrigatório"),
    teamSize: z.string().min(1, "Selecione o tamanho"),
    volumeDay: z.string().min(1, "Selecione o volume"),
    channels: z.array(z.string()).min(1, "Selecione pelo menos um canal"),

    stack: z.array(z.string()),

    pains: z.array(z.string()).min(1, "Selecione pelo menos uma dor"),
    urgency: z.string().min(1, "Selecione a urgência"),
    goal: z.string().min(1, "Obrigatório"),

    honeypot: z.string().optional()
});

export type AssessmentFormData = z.infer<typeof assessmentSchema>;
