import {
    buildWhatsAppCommercialQuickActions,
    composeWhatsAppCommercialTimeline,
} from "../lib/whatsapp/crm-service";

describe("WhatsApp CRM service helpers", () => {
    test("composes recent commercial events in descending order", () => {
        const timeline = composeWhatsAppCommercialTimeline({
            activities: [
                {
                    id: "activity-1",
                    title: "stage changed",
                    detail: "Contato para proposta",
                    eyebrow: "activity",
                    at: "2026-03-16T12:00:00.000Z",
                    tone: "warning",
                },
            ],
            proposals: [
                {
                    id: "proposal-1",
                    title: "Proposta v2",
                    detail: "sent",
                    eyebrow: "sent",
                    at: "2026-03-16T15:00:00.000Z",
                    tone: "warning",
                },
            ],
            meetings: [
                {
                    id: "meeting-1",
                    title: "Agenda comercial",
                    detail: "Preparar pauta",
                    eyebrow: "meeting",
                    at: "2026-03-16T18:00:00.000Z",
                    tone: "positive",
                },
            ],
        });

        expect(timeline.map((item) => item.kind)).toEqual(["meeting", "proposal", "activity"]);
        expect(timeline[0]?.title).toBe("Agenda comercial");
    });

    test("builds commercial quick actions for inbox-linked record execution", () => {
        const actions = buildWhatsAppCommercialQuickActions({
            orgSlug: "acme",
            assessmentId: "assessment-1",
            conversationId: "conversation-1",
            nextAction: "Responder conversa pendente",
            nextActionAt: "2026-03-17T14:00:00.000Z",
            recommendations: [
                {
                    id: "revive-stalled-proposal",
                    title: "Cobrar proposta parada",
                    reason: "A proposta pede retomada curta.",
                    playbookId: "revive-stalled-proposal",
                    actionLabel: "Cobrar proposta",
                },
            ],
            proposalPublicSlug: "prop-123",
        });

        expect(actions.map((action) => action.id)).toEqual(
            expect.arrayContaining(["open-crm-record", "register-follow-up", "mark-next-action", "playbook:revive-stalled-proposal", "open-proposal"]),
        );
        expect(actions.find((action) => action.id === "open-crm-record")).toMatchObject({
            kind: "link",
            href: "/org/acme/admin/crm?assessmentId=assessment-1",
        });
    });
});
