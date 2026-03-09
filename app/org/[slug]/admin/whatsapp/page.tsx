"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
    AlertCircle,
    LayoutGrid,
    MessageSquare,
    MoreVertical,
    Send,
    Settings,
    Users,
} from "lucide-react";
import { ProductWalkthrough } from "@/components/product-guide/walkthrough";
import { GuideLauncher } from "@/components/product-guide/guide-launcher";
import { GUIDE_IDS } from "@/lib/help/guide-ids";
import { InboxTab } from "./_components/inbox-tab";
import { CampaignsTab } from "./_components/campaigns-tab";
import { TemplatesTab } from "./_components/templates-tab";
import { TeamTab } from "./_components/team-tab";
import { SettingsTab } from "./_components/settings-tab";

export default function WhatsAppCRMPage() {
    const params = useParams();
    const slug = params.slug as string;
    const [activeTab, setActiveTab] = useState("inbox");
    const [stats, setStats] = useState({ total: 0, unassigned: 0, breached: 0 });
    const [forceStartGuide, setForceStartGuide] = useState(false);

    useEffect(() => {
        fetch(`/api/org/${slug}/whatsapp/stats`)
            .then((res) => res.json())
            .then((data) => setStats(data))
            .catch((err) => console.error("Stats fetch error:", err));
    }, [slug]);

    const tabs = [
        { id: "inbox", label: "Inbox", icon: MessageSquare, badge: stats.unassigned > 0 ? stats.unassigned : null },
        { id: "campaigns", label: "Campanhas", icon: Send },
        { id: "templates", label: "Templates", icon: LayoutGrid },
        { id: "team", label: "Equipe", icon: Users },
        { id: "settings", label: "Ajustes", icon: Settings },
    ];

    return (
        <div className="flex flex-col h-screen bg-[#050505] text-white font-sans selection:bg-gold/30">
            <ProductWalkthrough guide="whatsappCrm" forceStart={forceStartGuide} onClose={() => setForceStartGuide(false)} />
            <header className="h-16 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center shadow-lg shadow-gold/20">
                        <MessageSquare className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold tracking-tight uppercase text-gold/90">WhatsApp CRM</h1>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">Enterprise OS v36</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-wider">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-white/60">Total:</span>
                            <span className="text-white/90">{stats.total}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-colors">
                            <AlertCircle className="w-3 h-3 text-red-500" />
                            <span className="text-red-500/60">SLA:</span>
                            <span className="text-red-500">{stats.breached}</span>
                        </div>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <GuideLauncher guideKey="whatsappCrm" onStartGuide={() => setForceStartGuide(true)} />
                    <button className="p-2 rounded-full hover:bg-white/5 text-white/40 transition-colors">
                        <MoreVertical className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <nav className="w-20 lg:w-64 border-r border-white/5 bg-black/20 flex flex-col p-4 gap-2 transition-all duration-300">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        const guideId = tab.id === "campaigns" ? GUIDE_IDS.wa_campaigns_tab :
                            tab.id === "team" ? GUIDE_IDS.wa_team_tab : undefined;
                        return (
                            <button
                                key={tab.id}
                                data-guide-id={guideId}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                  flex items-center gap-3 p-3 rounded-xl transition-all relative group
                  ${isActive
                                        ? "bg-white/5 text-gold border border-gold/20"
                                        : "text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent"
                                    }
                `}
                            >
                                <div className={`
                  p-2 rounded-lg transition-colors
                  ${isActive ? "bg-gold/10 text-gold" : "bg-white/5 text-white/40 group-hover:text-white/80"}
                `}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <span className="hidden lg:block text-sm font-medium">{tab.label}</span>
                                {tab.badge && (
                                    <span className="absolute top-2 right-2 lg:relative lg:top-0 lg:ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg shadow-red-500/20">
                                        {tab.badge}
                                    </span>
                                )}
                                {isActive && (
                                    <div className="absolute left-0 w-1 h-6 bg-gold rounded-r-full shadow-lg shadow-gold/50" />
                                )}
                            </button>
                        );
                    })}
                </nav>

                <main className="flex-1 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-gold/[0.02] to-transparent pointer-events-none" />

                    <div className="h-full w-full">
                        {activeTab === "inbox" && <InboxTab />}
                        {activeTab === "campaigns" && <CampaignsTab />}
                        {activeTab === "templates" && <TemplatesTab />}
                        {activeTab === "team" && <TeamTab />}
                        {activeTab === "settings" && <SettingsTab />}
                    </div>
                </main>
            </div>
        </div>
    );
}
