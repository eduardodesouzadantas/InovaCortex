import { assessmentSchema } from "../lib/validations/assessment";

describe("assessmentSchema", () => {
    it("validates stack correctly", () => {
        const payload = {
            name: "John Doe",
            email: "john@example.com",
            phone: "11999999999",
            company: "Acme",
            role: "Developer",
            city: "SP",
            segment: "Tech",
            monthlyRevenue: "100k",
            teamSize: "10",
            customerVolume: "100",
            channels: ["Google Ads"],
            monthlyLeads: "100",
            conversionRate: "10%",
            responseTime: "Imediato",
            manualTasks: "Typing",
            hoursLost: "2h",
            crmUsage: "No",
            automationLevel: "Nenhuma",
            stack: ["Zendesk / Intercom", "Hubspot"],
            pains: ["Tempo de resposta lento"],
            urgency: "Alta",
            goal: "Vender mais"
        };

        const result = assessmentSchema.safeParse(payload);
        
        expect(result.success).toBe(true);
        if (!result.success) {
            console.error(result.error.issues);
        }
    });

    it("validates empty stack correctly", () => {
        const payload = {
            name: "John Doe",
            email: "john@example.com",
            phone: "11999999999",
            company: "Acme",
            role: "Developer",
            city: "SP",
            segment: "Tech",
            monthlyRevenue: "100k",
            teamSize: "10",
            customerVolume: "100",
            channels: ["Google Ads"],
            monthlyLeads: "100",
            conversionRate: "10%",
            responseTime: "Imediato",
            manualTasks: "Typing",
            hoursLost: "2h",
            crmUsage: "No",
            automationLevel: "Nenhuma",
            stack: [],
            pains: ["Tempo de resposta lento"],
            urgency: "Alta",
            goal: "Vender mais"
        };
        const result = assessmentSchema.safeParse(payload);
        expect(result.success).toBe(true);
    });
});
