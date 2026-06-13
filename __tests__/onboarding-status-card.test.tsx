/**
 * @jest-environment jsdom
 */

jest.mock("next/link", () => {
    return function MockLink({ href, children, ...props }: { href: string; children: ReactNode }) {
        return <a href={href} {...props}>{children}</a>;
    };
});

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { OnboardingStatusCard } from "../app/org/[slug]/admin/workspaces/onboarding-status-card";

describe("OnboardingStatusCard", () => {
    it("renders onboarding progress and action links", () => {
        render(
            <OnboardingStatusCard
                orgSlug="acme"
                onboarding={{
                    organizationId: "org-1",
                    status: "in_progress",
                    progressPercent: 67,
                    completedStepCount: 2,
                    totalStepCount: 3,
                    emailConnectedAt: "2026-03-18T10:00:00.000Z",
                    pipelineConfiguredAt: "2026-03-18T10:10:00.000Z",
                    firstContactAt: null,
                    firstDealAt: null,
                    firstCrmRecordAt: null,
                    completedAt: null,
                    updatedAt: "2026-03-18T10:10:00.000Z",
                    steps: [
                        {
                            id: "email",
                            label: "Conectar email",
                            detail: "A conexao OAuth do tenant ja esta ativa.",
                            status: "done",
                            completedAt: "2026-03-18T10:00:00.000Z",
                        },
                        {
                            id: "pipeline",
                            label: "Configurar pipeline",
                            detail: "A pipeline padrao do CRM ja foi iniciada.",
                            status: "done",
                            completedAt: "2026-03-18T10:10:00.000Z",
                        },
                        {
                            id: "first_crm_record",
                            label: "Primeiro contato/deal",
                            detail: "O tenant ja registrou o primeiro contato ou deal.",
                            status: "pending",
                            completedAt: null,
                        },
                    ],
                }}
            />,
        );

        expect(screen.getByText("Tenant onboarding")).toBeTruthy();
        expect(screen.getByText("67% completo")).toBeTruthy();
        expect(screen.getByText("Em progresso")).toBeTruthy();
        expect(screen.getByText("Go-live parcial bloqueado")).toBeTruthy();
        const reviewLinks = screen.getAllByRole("link", { name: "Revisar" });
        expect(reviewLinks).toHaveLength(2);
        expect(reviewLinks[0].getAttribute("href")).toBe("/org/acme/admin/email");
        expect(reviewLinks[1].getAttribute("href")).toBe("/org/acme/admin/crm");
        expect(screen.getByRole("link", { name: "Criar primeiro deal" }).getAttribute("href")).toBe("/org/acme/admin/deals");
    });
});
