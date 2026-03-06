"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ShieldCheck, PlayCircle, Settings, FileText, Check, X, ShieldAlert } from "lucide-react";
import HelpPopover from "@/components/product-guide/help-popover";

type TabValue = "playbooks" | "approvals" | "runs" | "policies" | "logs";

export default function ExecutionClient({ orgSlug, initialPlaybooks, initialApprovals, currentUser }: any) {
    const [activeTab, setActiveTab] = useState<TabValue>("playbooks");

    // Simplified Tabs array with icons and Help IDs attached
    const TABS = [
        { value: "playbooks", label: "Playbooks", icon: <Settings className="w-4 h-4" />, helpId: "exec_tab_playbooks" },
        { value: "approvals", label: "Aprovações", icon: <ShieldCheck className="w-4 h-4" />, helpId: "exec_tab_approvals", badge: initialApprovals.length },
        { value: "runs", label: "Execuções", icon: <PlayCircle className="w-4 h-4" />, helpId: "exec_tab_runs" },
        { value: "policies", label: "Políticas", icon: <ShieldAlert className="w-4 h-4" />, helpId: "exec_tab_policies" },
        { value: "logs", label: "Logs Internos", icon: <FileText className="w-4 h-4" />, helpId: "exec_tab_logs" },
    ];

    return (
        <div className="w-full relative z-10 flex flex-col space-y-6">
            <div className="flex overflow-x-auto pb-2 border-b border-zinc-800 scrollbar-hide">
                <div className="flex gap-2 min-w-max">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.value;
                        return (
                            <div key={tab.value} className="relative flex items-center">
                                <button
                                    onClick={() => setActiveTab(tab.value as TabValue)}
                                    className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${isActive ? "text-violet-400 bg-zinc-900/50" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30"
                                        }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                    {tab.badge > 0 && (
                                        <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-violet-600 text-white font-bold">
                                            {tab.badge}
                                        </span>
                                    )}
                                    {isActive && (
                                        <motion.div
                                            layoutId="executionTabs"
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"
                                            initial={false}
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                </button>
                                <HelpPopover guideId={tab.helpId} position="top" size="sm" />
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-4 relative bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 min-h-[500px] overflow-hidden">
                <AnimatePresence mode="wait">
                    {activeTab === "playbooks" && (
                        <motion.div
                            key="playbooks"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <Settings className="w-5 h-5 text-violet-400" />
                                Playbooks Ativos
                            </h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {initialPlaybooks.map((pb: any) => (
                                    <div key={pb.id} className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/50 hover:border-violet-500/50 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-semibold text-zinc-100">{pb.name}</h3>
                                            <span className={`px-2 py-1 text-xs rounded-lg font-medium ${pb.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20' : 'bg-zinc-700 text-zinc-300'}`}>
                                                {pb.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-400 mt-2">{pb.description}</p>
                                        <div className="mt-4 flex gap-2">
                                            <button className="px-3 py-1.5 text-xs bg-violet-600/20 text-violet-300 font-medium rounded-md hover:bg-violet-600/40">
                                                Details
                                            </button>
                                            <button className="px-3 py-1.5 text-xs bg-zinc-700/50 text-zinc-300 font-medium rounded-md hover:bg-zinc-700">
                                                Edit Policy
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "approvals" && (
                        <motion.div
                            key="approvals"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-violet-400" />
                                Fila de Aprovação
                            </h2>
                            {initialApprovals.length === 0 ? (
                                <div className="p-8 text-center text-zinc-500 bg-zinc-800/20 rounded-lg border border-zinc-800/50">
                                    Nenhuma aprovação pendente no momento.
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {initialApprovals.map((app: any) => (
                                        <div key={app.id} className="flex flex-col md:flex-row gap-4 p-4 rounded-lg bg-zinc-800/40 border border-violet-500/20 items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-zinc-200">Run ID: {app.playbookRunId}</p>
                                                <p className="text-xs text-zinc-400">Requisitado em: {new Date(app.createdAt).toLocaleString()}</p>
                                                <p className="text-xs font-mono text-zinc-500 mt-1">Regra de Segurança: {app.requiredRole}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-sm font-medium transition-colors">
                                                    <Check className="w-4 h-4" /> Approve
                                                </button>
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium transition-colors">
                                                    <X className="w-4 h-4" /> Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Additional Tabs omitted for brevity but they follow standard render structures */}
                    {activeTab !== "playbooks" && activeTab !== "approvals" && (
                        <motion.div
                            key="placeholder"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-8 text-center text-zinc-500"
                        >
                            Interface para {activeTab} em construção. Consulte \`system_events\` e \`playbook_runs\`.
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
