/**
 * app/org/[slug]/admin/layout.tsx
 * Shared layout for all admin pages — provides the sidebar navigation
 * so users can navigate between modules without typing URLs.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import Link from "next/link";
import {
    Activity, LayoutDashboard, Users, Zap, BarChart2, FileText,
    Award, Layers, DollarSign, LogOut, ChevronRight,
    Shield, BrainCircuit, Settings, User
} from "lucide-react";

const NAV_ITEMS = [
    {
        group: "War Room",
        items: [
            { href: "/cockpit", label: "Cockpit", icon: Activity, accent: true },
            { href: "", label: "Mission Control", icon: LayoutDashboard, accent: false },
        ],
    },
    {
        group: "Funil & Leads",
        items: [
            { href: "/sequences", label: "Sequências", icon: Zap, accent: false },
            { href: "/audit", label: "Auditoria", icon: Shield, accent: false },
        ],
    },
    {
        group: "Conteúdo",
        items: [
            { href: "/content", label: "Content Engine", icon: FileText, accent: false },
            { href: "/authority", label: "Authority Lib", icon: Award, accent: false },
        ],
    },
    {
        group: "Clientes",
        items: [
            { href: "/workspaces", label: "Workspaces", icon: Layers, accent: false },
            { href: "/custos", label: "Custos IA", icon: BarChart2, accent: false },
        ],
    },
    {
        group: "Financeiro",
        items: [
            { href: "/billing", label: "Billing", icon: DollarSign, accent: false },
        ],
    },
    {
        group: "Sistema",
        items: [
            { href: "/configuracoes", label: "Configurações", icon: Settings, accent: false },
        ],
    },
];

export default async function AdminLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}) {
    // Escape hatch for the login page to prevent infinite redirect loops
    const headersList = await headers();
    const pathname = headersList.get("x-invoke-path") || "";
    if (pathname.endsWith("/login")) {
        return <>{children}</>;
    }

    const { slug } = await params;

    let ctx: Awaited<ReturnType<typeof requireOrgContext>> | null = null;
    try {
        ctx = await requireOrgContext(slug);
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    const base = `/org/${slug}/admin`;

    return (
        <div className="flex min-h-screen bg-[#030712] text-white">
            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <aside className="w-56 shrink-0 border-r border-white/6 bg-[#050a14] flex flex-col sticky top-0 h-screen overflow-y-auto">
                {/* Logo */}
                <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/5">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                        <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-black text-xs tracking-tight truncate">{slug}</p>
                        <p className="text-xs text-muted-foreground/60 capitalize">{ctx!.plan} · {ctx!.role}</p>
                    </div>
                </div>

                {/* Nav groups */}
                <nav className="flex-1 px-2 py-4 space-y-5">
                    {NAV_ITEMS.map(group => (
                        <div key={group.group}>
                            <p className="text-xs font-medium text-muted-foreground/40 px-2 mb-1.5 uppercase tracking-widest">
                                {group.group}
                            </p>
                            <ul className="space-y-0.5">
                                {group.items.map(item => {
                                    const Icon = item.icon;
                                    const href = `${base}${item.href}`;
                                    return (
                                        <li key={item.href}>
                                            <Link href={href}
                                                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all group ${item.accent
                                                    ? "bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15"
                                                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                                                    }`}>
                                                <Icon className={`w-3.5 h-3.5 shrink-0 ${item.accent ? "text-primary" : "group-hover:text-white"}`} />
                                                {item.label}
                                                {item.accent && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className="border-t border-white/5 p-3">
                    <form action="/api/auth/logout" method="post" className="w-full">
                        <button className="flex items-center gap-2 text-xs text-muted-foreground/60 hover:text-red-400 transition-colors w-full px-2 py-1.5 rounded-lg hover:bg-red-400/5">
                            <LogOut className="w-3.5 h-3.5 shrink-0" />
                            Sair
                        </button>
                    </form>
                </div>
            </aside>

            {/* ── Main content ────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">
                {children}
            </div>
        </div>
    );
}
