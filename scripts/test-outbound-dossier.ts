import { prisma } from '../lib/prisma';
import { sendAssessmentDossierWhatsApp } from '../lib/whatsapp/assessment-send';

async function testOutboundFlow() {
    console.log("--- Starting WhatsApp Outbound Validation ---");

    // 1. Find or create a base organization
    const org = await prisma.organization.findFirst({
        where: { slug: 'inovacortex' }
    });

    if (!org) {
        console.error("Default organization 'inovacortex' not found. Please run seed or create manually.");
        return;
    }

    console.log(`Using Org: ${org.slug} (${org.id})`);

    // 2. Test Case 1: Skipped due to No Consent
    console.log("\n[Test 1] Testing Skip (No Consent)");
    const assessmentNoConsent = await prisma.assessment.create({
        data: {
            organizationId: org.id,
            name: "Test No Consent",
            email: "test_no_consent@example.com",
            company: "Test Co",
            role: "Tester",
            segment: "Tech",
            teamSize: "1-10",
            volumeDay: "10",
            urgency: "baixa",
            goal: "vendas",
            phone: "5511999999999",
            whatsappConsent: false,
            scoreTotal: 75,
            scoreBreakdown: "{}",
            classification: "Alta prioridade",
            recommendedMissions: "[]",
            pains: "[]",
            channels: "[]",
            stack: "[]"
        }
    });

    const result1 = await sendAssessmentDossierWhatsApp({ assessmentId: assessmentNoConsent.id });
    console.log("Result 1:", result1);

    const logs1 = await (prisma as any).messageLog.findMany({
        where: { assessmentId: assessmentNoConsent.id }
    });
    console.log("Logs for Test 1:", logs1.map((l: any) => ({ status: l.status, payload: l.payloadRedacted })));

    // 3. Test Case 2: Success Attempt (will fail Meta if token invalid, but should log 'processing')
    console.log("\n[Test 2] Testing Sending Initiation (Consent Active)");
    const assessmentWithConsent = await prisma.assessment.create({
        data: {
            organizationId: org.id,
            name: "Test With Consent",
            email: "test_consent@example.com",
            company: "Test Co",
            role: "Tester",
            segment: "Tech",
            teamSize: "11-50",
            volumeDay: "50",
            urgency: "alta",
            goal: "eficiencia",
            phone: "5511967011133", // Using authorized phone from .env for realism
            whatsappConsent: true,
            scoreTotal: 85,
            scoreBreakdown: "{}",
            classification: "Alta prioridade",
            recommendedMissions: "[]",
            pains: "[]",
            channels: "[]",
            stack: "[]"
        }
    });

    const result2 = await sendAssessmentDossierWhatsApp({ assessmentId: assessmentWithConsent.id });
    console.log("Result 2:", result2);

    const logs2 = await (prisma as any).messageLog.findMany({
        where: { assessmentId: assessmentWithConsent.id }
    });
    console.log("Logs for Test 2:", logs2.map((l: any) => ({ status: l.status, payload: l.payloadRedacted })));

    console.log("\n--- Validation Finished ---");
}

testOutboundFlow()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
