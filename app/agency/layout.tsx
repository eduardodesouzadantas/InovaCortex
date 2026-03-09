import Link from "next/link";
import { Building2, LogOut } from "lucide-react";

export default function AgencyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur">
                <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
                        <Building2 className="h-4 w-4 text-cyan-400" />
                        <span>InovaCortex Agency</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/agency/dashboard"
                            className="text-xs text-slate-300 transition-colors hover:text-white"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/agency/cockpit"
                            className="text-xs text-slate-300 transition-colors hover:text-white"
                        >
                            Cockpit
                        </Link>
                        <Link
                            href="/agency/settings"
                            className="text-xs text-slate-300 transition-colors hover:text-white"
                        >
                            Configuracoes
                        </Link>
                        <Link
                            href="/agency/commercial/leads"
                            className="text-xs text-slate-300 transition-colors hover:text-white"
                        >
                            Commercial Leads
                        </Link>
                        <Link
                            href="/agency/commercial/workspaces"
                            className="text-xs text-slate-300 transition-colors hover:text-white"
                        >
                            Workspaces
                        </Link>
                        <Link
                            href="/agency/content"
                            className="text-xs text-slate-300 transition-colors hover:text-white"
                        >
                            Content
                        </Link>
                        <Link
                            href="/agency/authority"
                            className="text-xs text-slate-300 transition-colors hover:text-white"
                        >
                            Authority
                        </Link>
                        <Link
                            href="/agency/monitoring"
                            className="text-xs text-slate-300 transition-colors hover:text-white"
                        >
                            Monitoring
                        </Link>
                        <Link
                            href="/agency/costs"
                            className="text-xs text-slate-300 transition-colors hover:text-white"
                        >
                            Costs
                        </Link>
                        <Link
                            href="/agency/executive"
                            className="text-xs text-slate-300 transition-colors hover:text-white"
                        >
                            Executive
                        </Link>
                        <Link
                            href="/agency/command-center"
                            className="text-xs text-slate-300 transition-colors hover:text-white"
                        >
                            Command
                        </Link>
                        <Link
                            href="/agency/executive-pack"
                            className="text-xs text-slate-300 transition-colors hover:text-white"
                        >
                            Exec Pack
                        </Link>
                        <form action="/api/agency/auth/logout" method="post">
                            <button
                                type="submit"
                                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                Sair
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
                {children}
            </main>
        </div>
    );
}
