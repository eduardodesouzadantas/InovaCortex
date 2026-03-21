import type { Metadata } from "next";

import { EmpresaLoginClient } from "./empresa-login-client";
import { getAuthContext } from "@/lib/auth/session";
import { resolveDefaultRedirect } from "@/lib/auth/resolveDefaultRedirect";

export const metadata: Metadata = {
    title: "Empresa | InovaCortex",
    description: "Acesso direto da empresa à plataforma InovaCortex.",
};

export const dynamic = "force-dynamic";

export default async function EmpresaLoginPage() {
    const auth = await getAuthContext();
    const continueHref = auth.isAuthenticated ? await resolveDefaultRedirect() : null;

    return (
        <main className="min-h-screen bg-[#050816] text-white">
            <div className="relative mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-10">
                <EmpresaLoginClient continueHref={continueHref} />
            </div>
        </main>
    );
}
