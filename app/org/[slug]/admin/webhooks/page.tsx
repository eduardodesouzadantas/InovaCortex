import { redirect } from "next/navigation";

import { assertRole } from "@/lib/auth/rbac";
import { requireOrgContext } from "@/lib/auth/org-context";
import { listWebhookEndpoints } from "@/lib/public-api/webhooks";

import { WebhookAdminClient } from "./webhooks-admin-client";

export const runtime = "nodejs";

export default async function OrgWebhooksPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug: orgSlug } = await params;

    const ctx = await requireOrgContext(orgSlug).catch(() => null);
    if (!ctx) {
        redirect(`/org/${orgSlug}/admin/login`);
    }
    assertRole(ctx.role, "admin");

    const initial = await listWebhookEndpoints(ctx.orgId);

    return (
        <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
            <div className="max-w-4xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                    Tenant System / Webhooks
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                    Webhooks
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                    Cadastre endpoints por tenant para receber eventos assinados da plataforma. O segredo so aparece
                    no momento da criacao ou rotacao, e a tela reflete o status operacional sem criar uma console
                    paralela.
                </p>
            </div>

            <div className="mt-8">
                <WebhookAdminClient
                    orgSlug={orgSlug}
                    initialWebhooks={initial.webhooks}
                    supportedEvents={initial.supportedEvents}
                />
            </div>
        </div>
    );
}
