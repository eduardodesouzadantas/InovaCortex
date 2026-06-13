import { redirect } from "next/navigation";

import { SurfaceShell } from "@/components/navigation/surface-shell";
import { AccountStatusBanner } from "@/components/billing/account-status-banner";
import { requireOrgContext } from "@/lib/auth/org-context";
import { getAuthContext } from "@/lib/auth/session";
import { evaluateExecutiveSurfaceAccess } from "@/lib/executive/access";
import { buildTenantExecutiveSurfaceDefinition } from "@/lib/front/surface-architecture";
import { normalizeOrganizationAccountStatus, organizationAccountStatusLabel } from "@/lib/billing/account-status";

import { ExecutiveAccessDenied } from "../_components/executive-access-denied";

export default async function TenantExecutiveSurfaceLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const auth = await getAuthContext();
    const access = evaluateExecutiveSurfaceAccess(auth, slug);

    if (access.state === "redirect") {
        redirect(access.redirectTo);
    }

    if (access.state === "forbidden") {
        return <ExecutiveAccessDenied slug={slug} />;
    }

    const ctx = await requireOrgContext(slug).catch(() => null);
    if (!ctx) {
        redirect(`/org/${slug}/executive/login?reason=TENANT_MISMATCH`);
    }

    return (
        <SurfaceShell
            surface={buildTenantExecutiveSurfaceDefinition(slug)}
            contextBadge={`${slug} · ${ctx.plan} · ${ctx.role} · ${organizationAccountStatusLabel(normalizeOrganizationAccountStatus(ctx.subscriptionStatus))}`}
            logoutAction="/api/auth/logout"
        >
            <div className="space-y-4">
                <AccountStatusBanner slug={slug} subscriptionStatus={ctx.subscriptionStatus} />
                {children}
            </div>
        </SurfaceShell>
    );
}
