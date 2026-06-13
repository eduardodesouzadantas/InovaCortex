jest.mock("next/link", () => {
    const ReactModule = jest.requireActual<typeof import("react")>("react");
    return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
            ReactModule.createElement("a", { href, ...props }, children),
    };
});

import { renderToStaticMarkup } from "react-dom/server";

import { ConversationCommercialContext } from "../app/org/[slug]/admin/whatsapp/_components/conversation-commercial-context";

describe("conversation commercial context", () => {
    test("renders CRM-linked context and quick actions inside the inbox rail", () => {
        const html = renderToStaticMarkup(
            <ConversationCommercialContext
                context={{
                    conversationId: "conversation-1",
                    contact: {
                        id: "contact-1",
                        name: "Maria",
                        phoneNumberE164: "5511999999999",
                        lifecycle: "lead",
                        tags: ["vip"],
                        waId: "5511999999999",
                    },
                    attention: {
                        label: "Resposta pendente",
                        detail: "1 mensagem aguardando retorno.",
                        tone: "warning",
                    },
                    record: {
                        assessmentId: "assessment-1",
                        company: "Acme",
                        status: "Novo",
                        scoreLabel: "72 · Alta",
                        stageId: "stage-1",
                        stageLabel: "Contato",
                        proposalLabel: "sent · v2",
                        proposalPublicSlug: "prop-123",
                        ownerLabel: "Responsavel atribuido",
                        priority: "high",
                        cadenceLabel: "Cadencia de follow-up inicial",
                        nextAction: "Responder conversa pendente",
                        nextActionAtLabel: "17/03/2026 14:00",
                        crmHref: "/org/acme/admin/crm?assessmentId=assessment-1",
                        stageOptions: [{ value: "stage-1", label: "Contato" }, { value: "stage-2", label: "Proposta" }],
                    },
                    recommendations: [
                        {
                            id: "revive-stalled-proposal",
                            title: "Cobrar proposta parada",
                            reason: "A proposta pede retomada curta.",
                            playbookId: "revive-stalled-proposal",
                            actionLabel: "Cobrar proposta",
                        },
                    ],
                    recentEvents: [
                        {
                            id: "proposal:proposal-1",
                            kind: "proposal",
                            title: "Proposta v2",
                            detail: "sent",
                            eyebrow: "sent",
                            at: "2026-03-16T15:00:00.000Z",
                            tone: "warning",
                        },
                    ],
                    quickActions: [
                        {
                            id: "open-crm-record",
                            assessmentId: "assessment-1",
                            label: "Abrir record 360",
                            description: "Abre o CRM",
                            tone: "neutral",
                            kind: "link",
                            href: "/org/acme/admin/crm?assessmentId=assessment-1",
                        },
                        {
                            id: "register-follow-up",
                            assessmentId: "assessment-1",
                            label: "Registrar follow-up",
                            description: "Salva proxima acao",
                            tone: "positive",
                            kind: "inline-update",
                            field: "workspace.nextAction",
                            value: "Responder conversa pendente",
                        },
                    ],
                }}
                conversationStatus="open"
                contact={{
                    name: "Maria",
                    phoneNumberE164: "5511999999999",
                    lifecycle: "lead",
                    wa_id: "5511999999999",
                    tags: "[\"vip\"]",
                    lastMessageAt: "2026-03-16T15:00:00.000Z",
                }}
                isOutside24h={false}
                isBlockedContact={false}
                actionLoading={null}
                actionError={null}
                commercialPendingKey={null}
                commercialNotice={null}
                contextLoading={false}
                contextError={null}
            />,
        );

        expect(html).toContain("Contexto comercial");
        expect(html).toContain("Quick actions comerciais");
        expect(html).toContain("Abrir record 360");
        expect(html).toContain("Atualizar stage");
        expect(html).toContain("Atividades recentes");
        expect(html).toContain("Cobrar proposta parada");
    });

    test("renders safe fallback when the conversation still has no commercial record", () => {
        const html = renderToStaticMarkup(
            <ConversationCommercialContext
                context={{
                    conversationId: "conversation-2",
                    contact: {
                        id: "contact-2",
                        name: "Lead novo",
                        phoneNumberE164: "5511888888888",
                        lifecycle: "lead",
                        tags: [],
                        waId: null,
                    },
                    attention: {
                        label: "Conversa ativa",
                        detail: "O canal esta pronto para continuidade operacional.",
                        tone: "positive",
                    },
                    record: null,
                    recommendations: [],
                    recentEvents: [],
                    quickActions: [],
                }}
                conversationStatus="open"
                contact={{
                    name: "Lead novo",
                    phoneNumberE164: "5511888888888",
                    lifecycle: "lead",
                    wa_id: null,
                    tags: "[]",
                    lastMessageAt: null,
                }}
                isOutside24h={true}
                isBlockedContact={false}
                actionLoading={null}
                actionError={null}
                commercialPendingKey={null}
                commercialNotice={null}
                contextLoading={false}
                contextError={null}
            />,
        );

        expect(html).toContain("Conversa ainda sem vinculo comercial completo");
        expect(html).toContain("Sessao expirada");
    });
});
