import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SurfaceShell } from "@/components/navigation/surface-shell";
import { isAgencyLoginPath } from "@/lib/navigation/surface-shell";
import { getAuthContext } from "@/lib/auth/session";
import { buildAgencySurfaceDefinition } from "@/lib/front/surface-architecture";

export default async function AgencyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const headersList = await headers();
    const pathname =
        headersList.get("x-invoke-path") ||
        headersList.get("x-matched-path") ||
        headersList.get("next-url") ||
        "";
    if (isAgencyLoginPath(pathname)) {
        return <>{children}</>;
    }

    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency") {
        redirect("/agency/login");
    }

    const surface = buildAgencySurfaceDefinition();

    return (
        <SurfaceShell
            surface={surface}
            contextBadge={`Agency scope · ${auth.role ?? "restricted"} · ${auth.organizationSlug ?? "inovacortex"}`}
            logoutAction="/api/agency/auth/logout"
            topActions={(
                <div className="flex items-center gap-2">
                    <Link
                        href="/agency/dashboard"
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
                    >
                        Agency Home
                    </Link>
                    <Link
                        href="/agency/command-center"
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
                    >
                        Command Center
                    </Link>
                </div>
            )}
        >
            {children}
        </SurfaceShell>
    );
}
