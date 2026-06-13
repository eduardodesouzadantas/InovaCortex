import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountStatusBanner } from "@/components/billing/account-status-banner";
import { requireOrgContext } from "@/lib/auth/org-context";
import { canAccessExecutiveSurface } from "@/lib/executive/access";
import { buildTenantOperatorSurfaceDefinition } from "@/lib/front/surface-architecture";
import { SurfaceShell } from "@/components/navigation/surface-shell";
import { normalizeOrganizationAccountStatus, organizationAccountStatusLabel } from "@/lib/billing/account-status";

export default async function AdminLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    const ctx = await requireOrgContext(slug).catch(() => null);
    if (!ctx) {
        redirect(`/org/${slug}/admin/login`);
    }

    const canAccessExecutive = canAccessExecutiveSurface(ctx.role);
    const surface = buildTenantOperatorSurfaceDefinition({
        slug,
        canAccessExecutive,
    });

    return (
        <SurfaceShell
            surface={surface}
            contextBadge={`${slug} · ${ctx.plan} · ${ctx.role} · ${organizationAccountStatusLabel(normalizeOrganizationAccountStatus(ctx.subscriptionStatus))}`}
            logoutAction="/api/auth/logout"
            topActions={(
                <div className="flex items-center gap-2">
                    <Link
                        href={`/org/${slug}/admin/crm`}
                        className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/15"
                    >
                        CRM Workspace
                    </Link>
                    <Link
                        href={`/org/${slug}/admin/whatsapp`}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
                    >
                        WhatsApp CRM
                    </Link>
                    <Link
                        href={`/org/${slug}/admin/webhooks`}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
                    >
                        Webhooks
                    </Link>
                    <Link
                        href={`/org/${slug}/admin/workspaces`}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
                    >
                        Fila de execucao
                    </Link>
                    {canAccessExecutive ? (
                        <Link
                            href={`/org/${slug}/executive`}
                            className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-400/15"
                        >
                            CEO Surface
                        </Link>
                    ) : null}
                </div>
            )}
        >
            <div className="space-y-4">
                <AccountStatusBanner slug={slug} subscriptionStatus={ctx.subscriptionStatus} />
                {children}
            </div>
        </SurfaceShell>
    );
}
