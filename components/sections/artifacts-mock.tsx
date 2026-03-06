import { Card } from "@/components/ui/card";
import { CheckCircle2, FileJson, LayoutTemplate, Terminal } from "lucide-react";

export function ArtifactsSection() {
    return (
        <section className="py-24 bg-background relative border-y border-border/40">
            <div className="container mx-auto px-4 md:px-8 max-w-screen-xl relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

                    {/* Text Content */}
                    <div className="lg:w-1/2 space-y-6">
                        <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-2">
                            <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
                            Artifacts & Governança
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            Cada Sistema Entregue é <span className="text-gradient">Auditável</span>.
                        </h2>

                        <div className="text-lg text-muted-foreground leading-relaxed space-y-4">
                            <p className="font-medium text-foreground">Não operamos caixas-pretas.</p>
                            <p>Toda ação gera artefatos verificáveis:</p>
                        </div>

                        <ul className="space-y-3 pt-2 grid sm:grid-cols-2 gap-x-4">
                            {[
                                "Logs estruturados",
                                "Histórico de decisões",
                                "Versionamento de prompts",
                                "Monitoramento de performance",
                                "Métricas de custo e eficiência",
                                "Trilhas de auditoria"
                            ].map((item, i) => (
                                <li key={i} className="flex items-center text-foreground text-sm md:text-base">
                                    <CheckCircle2 className="h-4 w-4 text-primary mr-3 shrink-0" />
                                    {item}
                                </li>
                            ))}
                        </ul>

                        <div className="pt-6 border-t border-border/50 mt-8 space-y-2">
                            <p className="text-accent font-medium">Projetado com Security by Design.</p>
                            <p className="text-muted-foreground">Preparado para ambientes enterprise.</p>
                            <p className="text-muted-foreground">Compatível com compliance e governança corporativa.</p>
                        </div>
                    </div>

                    {/* Visual */}
                    <div className="lg:w-1/2 w-full">
                        <div className="relative rounded-xl bg-gradient-to-b from-muted to-background p-1 border border-border/50 shadow-2xl">
                            {/* Fake Window Header */}
                            <div className="flex items-center px-4 py-3 border-b border-border/50 bg-background/50 rounded-t-lg">
                                <div className="flex space-x-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                                </div>
                                <div className="ml-4 flex text-xs text-muted-foreground space-x-4">
                                    <div className="flex items-center"><Terminal className="w-3 h-3 mr-1" /> mission_control.log</div>
                                    <div className="flex items-center text-primary"><FileJson className="w-3 h-3 mr-1" /> audit_trail.json</div>
                                </div>
                            </div>

                            {/* Fake Content Area */}
                            <div className="p-6 bg-[#0a0a0a] rounded-b-lg font-mono text-sm text-gray-300 min-h-[300px] relative overflow-hidden">
                                <div className="space-y-3">
                                    <p className="text-gray-500">{"[2026-02-26 10:23:45] INFO [Agent:Finance] Initiating transaction review."}</p>
                                    <p className="text-primary animate-pulse">{"[2026-02-26 10:23:46] WAIT [Governance] Requesting human approval for > 50k."}</p>
                                    <p className="text-gray-500">{"[2026-02-26 10:25:12] INFO [User:Admin] Approval received."}</p>
                                    <p className="text-accent">{"{"}</p>
                                    <p className="pl-4 text-gray-400">{"\"action_id\": \"trx_88921\","}</p>
                                    <p className="pl-4 text-gray-400">{"\"status\": \"executed\","}</p>
                                    <p className="pl-4 text-gray-400">{"\"prompt_version\": \"v2.4.1\","}</p>
                                    <p className="pl-4 text-gray-400">{"\"cost_usd\": 0.0042"}</p>
                                    <p className="text-accent">{"}"}</p>
                                    <p className="text-gray-500">{"[2026-02-26 10:25:13] INFO [MissionControl] Artifact saved to audit trail."}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
