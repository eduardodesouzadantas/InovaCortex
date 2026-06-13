import { prisma } from "@/lib/prisma";

export type OrganizationAccountStatus = "active" | "trial" | "suspended";

export const ORGANIZATION_BILLING_SUSPENDED_MESSAGE = "Conta suspensa. Regularize o billing para continuar.";

export function normalizeOrganizationAccountStatus(value: string | null | undefined): OrganizationAccountStatus {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

    if (normalized === "active") return "active";
    if (normalized === "trial" || normalized === "trialing" || normalized === "none") return "trial";
    if (normalized === "suspended" || normalized === "past_due" || normalized === "canceled" || normalized === "cancelled" || normalized === "paused" || normalized === "unpaid" || normalized === "incomplete_expired") {
        return "suspended";
    }

    return "trial";
}

export function organizationAccountStatusLabel(status: OrganizationAccountStatus): string {
    switch (status) {
        case "active":
            return "Ativa";
        case "suspended":
            return "Suspensa";
        default:
            return "Trial";
    }
}

export function organizationAccountStatusTone(status: OrganizationAccountStatus): "positive" | "warning" | "critical" {
    switch (status) {
        case "active":
            return "positive";
        case "suspended":
            return "critical";
        default:
            return "warning";
    }
}

export function isOrganizationSuspended(value: string | null | undefined): boolean {
    return normalizeOrganizationAccountStatus(value) === "suspended";
}

export type OrganizationAccountStatusDb = {
    organization: {
        findUnique: (args: {
            where: { id: string };
            select: { subscriptionStatus: true };
        }) => Promise<{ subscriptionStatus: string | null } | null>;
    };
};

export async function getOrganizationAccountStatus(
    organizationId: string,
    db: OrganizationAccountStatusDb = prisma as unknown as OrganizationAccountStatusDb,
): Promise<OrganizationAccountStatus> {
    const organization = await db.organization.findUnique({
        where: { id: organizationId },
        select: { subscriptionStatus: true },
    });

    return normalizeOrganizationAccountStatus(organization?.subscriptionStatus);
}
