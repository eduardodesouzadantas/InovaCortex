import Link from "next/link";
import {
    Activity,
    BarChart3,
    Bot,
    BriefcaseBusiness,
    Building2,
    Command,
    FileText,
    LogOut,
    MessageSquareText,
    Radar,
    Settings,
    ShieldCheck,
    Sparkles,
    Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { SurfaceDefinition, SurfaceIconKey } from "@/lib/front/surface-architecture";

const ICONS: Record<SurfaceIconKey, React.ComponentType<{ className?: string }>> = {
    activity: Activity,
    "bar-chart": BarChart3,
    brain: Bot,
    briefcase: BriefcaseBusiness,
    building: Building2,
    command: Command,
    file: FileText,
    message: MessageSquareText,
    radar: Radar,
    settings: Settings,
    shield: ShieldCheck,
    sparkles: Sparkles,
    users: Users,
};

const THEMES: Record<SurfaceDefinition["kind"], {
    page: string;
    panel: string;
    border: string;
    accent: string;
    accentSoft: string;
    badge: string;
}> = {
    agency: {
        page: "bg-[#07111d] text-white",
        panel: "bg-[#0a1624]",
        border: "border-cyan-400/14",
        accent: "text-cyan-200",
        accentSoft: "bg-cyan-400/10",
        badge: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
    },
    operator: {
        page: "bg-[#030712] text-white",
        panel: "bg-[#07101c]",
        border: "border-white/8",
        accent: "text-emerald-200",
        accentSoft: "bg-emerald-400/10",
        badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    },
    ceo: {
        page: "bg-[#06111f] text-white",
        panel: "bg-[#091a2b]",
        border: "border-amber-400/14",
        accent: "text-amber-100",
        accentSoft: "bg-amber-400/10",
        badge: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    },
};

export function SurfaceShell({
    surface,
    contextBadge,
    logoutAction,
    topActions,
    children,
}: {
    surface: SurfaceDefinition;
    contextBadge: string;
    logoutAction: string;
    topActions?: React.ReactNode;
    children: React.ReactNode;
}) {
    const theme = THEMES[surface.kind];

    return (
        <div className={cn("min-h-screen", theme.page)}>
            <div className="flex min-h-screen flex-col lg:flex-row">
                <aside className={cn("w-full shrink-0 border-b p-5 lg:sticky lg:top-0 lg:h-screen lg:w-[320px] lg:border-b-0 lg:border-r lg:p-6", theme.panel, theme.border)}>
                    <div className="rounded-[28px] border border-white/8 bg-black/10 p-5">
                        <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]", theme.badge)}>
                            <Sparkles className="h-3.5 w-3.5" />
                            {surface.label}
                        </div>
                        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{surface.title}</h1>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{surface.description}</p>
                        <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                            {contextBadge}
                        </div>
                    </div>

                    <nav className="mt-6 space-y-5">
                        {surface.sections.map((section) => (
                            <section key={section.id} className="rounded-[28px] border border-white/8 bg-black/10 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                                    {section.label}
                                </p>
                                <p className="mt-2 text-xs leading-5 text-slate-400">{section.description}</p>
                                <div className="mt-4 space-y-2">
                                    {section.items.map((item) => {
                                        const Icon = ICONS[item.icon];

                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className="block rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 transition hover:border-white/16 hover:bg-white/[0.07]"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("rounded-2xl p-2", theme.accentSoft)}>
                                                        <Icon className={cn("h-4 w-4", theme.accent)} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-medium text-white">{item.label}</p>
                                                            {item.badge ? (
                                                                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                                                                    {item.badge}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </nav>

                    <div className="mt-6 space-y-3">
                        {surface.crossLinks.map((item) => {
                            const Icon = ICONS[item.icon];
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 transition hover:border-white/16 hover:bg-white/[0.07]"
                                >
                                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", theme.accent)} />
                                    <div>
                                        <p className="text-sm font-medium text-white">{item.label}</p>
                                        <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </aside>

                <div className="min-w-0 flex-1">
                    <header className="sticky top-0 z-20 border-b border-white/8 bg-black/20 backdrop-blur-xl">
                        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4 md:px-8">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{surface.label}</p>
                                <p className="mt-1 text-sm text-slate-300">{surface.description}</p>
                            </div>

                            <div className="flex items-center gap-3">
                                {topActions}
                                <form action={logoutAction} method="post">
                                    <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white">
                                        <LogOut className="h-4 w-4" />
                                        Sair
                                    </button>
                                </form>
                            </div>
                        </div>
                    </header>

                    <main className="mx-auto max-w-[1600px] px-6 py-8 md:px-8">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
