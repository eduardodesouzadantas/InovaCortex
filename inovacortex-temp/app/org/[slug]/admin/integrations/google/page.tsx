import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GoogleIntegrationClient } from "./google-integration-client";

export const runtime = "nodejs";

export default async function GoogleCalendarIntegrationPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    let ctx: Awaited<ReturnType<typeof requireOrgContext>>;
    try {
        ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "admin");
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    const integration = await (prisma as any).calendarIntegration.findUnique({
        where: { organizationId: ctx!.orgId }
    });

    return (
        <div className="min-h-screen bg-[#030712] text-white p-8 max-w-2xl mx-auto">
            <div className="mb-8">
                <a href={`/org/${slug}/admin/cockpit`} className="text-xs text-muted-foreground hover:text-white transition-colors">← Voltar ao Cockpit</a>
            </div>

            <div className="flex items-center gap-4 mb-8">
                {/* Google logo */}
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-2xl shadow">
                    <svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-black">Google Calendar + Meet</h1>
                    <p className="text-sm text-muted-foreground">Crie eventos com links do Google Meet automaticamente a partir de reuniões agendadas</p>
                </div>
            </div>

            <GoogleIntegrationClient
                orgSlug={slug}
                integration={integration ? {
                    status: integration.status,
                    ownerEmail: integration.ownerEmail,
                    lastError: integration.lastError,
                    calendarId: integration.calendarId,
                    updatedAt: integration.updatedAt?.toISOString(),
                } : null}
            />
        </div>
    );
}
