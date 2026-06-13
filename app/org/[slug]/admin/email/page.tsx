import { redirect } from "next/navigation";
import { assertRole } from "@/lib/auth/rbac";
import { requireOrgContext } from "@/lib/auth/org-context";
import { getEmailIntegrationView, isEmailOAuthProviderConfigured } from "@/lib/integrations/email-oauth";
import { type EmailIntegrationView } from "@/lib/integrations/email-oauth-types";
import { EmailIntegrationsClient } from "./email-integrations-client";

export default async function EmailIntegrationsPage({
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

    const integration: EmailIntegrationView | null = await getEmailIntegrationView(ctx.orgId);

    return (
        <div className="mx-auto max-w-4xl p-8">
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Unified Inbox</h1>
            <p className="text-slate-300 mb-8 max-w-2xl leading-7">
                Conecte seu email profissional para centralizar a operação no CRM sem criar uma caixa paralela.
                A autenticação OAuth real roda no backend, com isolamento por tenant e credenciais criptografadas.
                A sincronização automática continua em segundo plano; o refresh manual é complementar e não há realtime nesta tela.
            </p>

            <EmailIntegrationsClient
                orgSlug={orgSlug}
                initialIntegration={integration}
                providerAvailability={{
                    google: isEmailOAuthProviderConfigured("google"),
                    microsoft: isEmailOAuthProviderConfigured("microsoft"),
                }}
            />
        </div>
    );
}
