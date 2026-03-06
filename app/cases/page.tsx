import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, BarChart3, CheckCircle2, Clock, Code2, Database, MessageSquare, Shield, Users, Zap } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { FadeIn } from "@/components/fade-in";

export const metadata: Metadata = {
    title: "Casos de Sucesso",
    description: "Veja exemplos reais de como nossa tecnologia Agent-First está transformando empresas e operações.",
};

export default function CasesPage() {
    const cases = [
        {
            company: "TechRetail Br",
            image: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)",
            problema: "A TechRetail precisava escalar sua operação na Black Friday sem triplicar a folha de pagamento do time de suporte que lidava com processos manuais repetitivos.",
            arquitetura: "Cluster de agentes LLM orquestrados com acesso a base de conhecimento dinâmica e integrados ao CRM para ações diretas, atuando de forma assíncrona 24/7.",
            agentes: [
                "Agente de Triagem Técnica",
                "Agente de Políticas de Troca",
                "Agente de Rastreamento de Pedidos"
            ],
            integracoes: ["Zendesk API", "WhatsApp Business REST", "VTEX Cloud"],
            missionControl: "Dashboard de supervisão em tempo real. Estornos acima de R$500 configurados para exigir aprovação humana obrigatória.",
            artifacts: ["Logs estruturados de 1.2M conversas", "Histórico de decisões de reembolso", "Métricas consolidadas de satisfação (NPS)"],
            resultados: [
                "1.2M interações geridas autonomamente",
                "Aumento de 15 pontos no NPS",
                "Tempo de resposta reduzido para < 2 minutos"
            ]
        },
        {
            company: "LogisCorp Global",
            image: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
            problema: "Sistema de gestão de frotas legado e rígido, rodando em dezenove monolitos PHP antigos, gerando lentidão e travamentos no monitoramento.",
            arquitetura: "Infraestrutura Next.js + Serverless na AWS para ingerir alto volume de dados, acoplada a agentes preditivos para alertas de manutenção baseados em padrões de rede.",
            agentes: [
                "Agente Preditivo IoT",
                "Agente Roteirizador Avançado",
                "Agente de Consumo e Anomalias"
            ],
            integracoes: ["AWS Kinesis", "TimescaleDB", "APIs de Telemetria de Veículos Pesados"],
            missionControl: "Controle de acesso granular (RBAC) e alertas críticos disparados diretamente no PagerDuty para os gerentes de logística.",
            artifacts: ["Geração dinâmica de relatórios de frota", "Trilhas de auditoria de manutenções sugeridas", "Versionamento contínuo de regras de ingestão"],
            resultados: [
                "Zero downtime em 12 meses de operação crítica",
                "Redução de 30% nos custos operacionais",
                "+50k veículos rastreados simultaneamente"
            ]
        },
        {
            company: "FinHoldings",
            image: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
            problema: "Gargalo contábil com milhares de notas fiscais espalhadas por portais distintos, exigindo 5 dias inteiros de trabalho manual de reconciliação mensal.",
            arquitetura: "Pipelines serverless orquestrando RPA (Robotic Process Automation) com agentes de visão computacional (OCR avançado) para extração confiável de tabelas.",
            agentes: [
                "Agente Extrator de Documentos Fiscais",
                "Agente de Identificação de Divergências Ativas"
            ],
            integracoes: ["SAP ECC (via RFC)", "Azure Document Intelligence", "Portais Federais/Estaduais (Playwright/RPA)"],
            missionControl: "Fluxo de monitoramento de exceções. Notas com nível de confiança OCR < 95% isoladas em sandbox para revisão contábil manual.",
            artifacts: ["Tabelas consolidadas diárias automáticas", "Registro (Logs) em banco para comprovação de auditoria (Compliance)"],
            resultados: [
                "Processo de 5 dias encurtado para apenas 2 horas",
                "Eliminação de 100% dos erros de digitação (100% Compliance)",
                "Analistas liberados para atividades estratégicas"
            ]
        }
    ];

    return (
        <div className="flex flex-col min-h-screen">
            <FadeIn delay={0}>
                <section className="relative pt-32 pb-20 border-b border-border/40 overflow-hidden bg-muted/10">
                    <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
                        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-10 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
                    </div>

                    <div className="container mx-auto px-4 md:px-8 max-w-screen-xl relative z-10 text-center">
                        <Badge variant="outline" className="mb-6 font-normal border-primary/30 bg-primary/5 text-primary">
                            Infraestrutura na Prática
                        </Badge>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
                            Casos de <span className="text-gradient">Sucesso</span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                            A tecnologia Agent-First solucionando problemas reais em escala corporativa, com transparência e governança aplicada ponto-a-ponto.
                        </p>
                    </div>
                </section>
            </FadeIn>

            <FadeIn delay={150}>
                <section className="py-24">
                    <div className="container mx-auto px-4 md:px-8 max-w-screen-xl">
                        <div className="grid gap-20">
                            {cases.map((caseItem, idx) => (
                                <Card key={idx} className="overflow-hidden border-border/50 bg-background/50 hover:border-primary/50 transition-colors group relative">
                                    <div className="absolute top-0 right-0 p-4 h-full w-2 flex flex-col justify-start">
                                        <div className="h-full w-full rounded-full" style={{ background: caseItem.image }} />
                                    </div>

                                    {/* Company Title */}
                                    <div className="p-8 pb-0 md:p-12 md:pb-6 relative z-10">
                                        <h2 className="text-3xl lg:text-4xl font-extrabold mb-1">{caseItem.company}</h2>
                                        <div className="h-1 w-20 rounded-full mt-4" style={{ background: caseItem.image }}></div>
                                    </div>

                                    <CardContent className="p-8 md:p-12 grid gap-12 lg:grid-cols-2 relative z-10 pt-6">

                                        {/* Left Column */}
                                        <div className="space-y-10">
                                            {/* Problema Operacional */}
                                            <div>
                                                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Problema Operacional</h4>
                                                <p className="text-lg text-foreground font-medium leading-relaxed">
                                                    {caseItem.problema}
                                                </p>
                                            </div>

                                            {/* Arquitetura Proposta */}
                                            <div>
                                                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Arquitetura Proposta</h4>
                                                <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
                                                    <p className="text-base text-foreground leading-relaxed">
                                                        {caseItem.arquitetura}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Agentes Criados */}
                                            <div>
                                                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Agentes Especializados</h4>
                                                <ul className="space-y-2">
                                                    {caseItem.agentes.map((agente, i) => (
                                                        <li key={i} className="flex items-start text-foreground">
                                                            <CheckCircle2 className="h-5 w-5 text-primary mr-3 shrink-0" />
                                                            <span className="font-medium">{agente}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Integrações */}
                                            <div>
                                                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Integrações</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {caseItem.integracoes.map(tech => (
                                                        <Badge key={tech} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 font-medium">
                                                            {tech}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column */}
                                        <div className="space-y-10 lg:pl-10 lg:border-l border-border/40">
                                            {/* Mission Control */}
                                            <div>
                                                <h4 className="text-sm font-bold text-accent uppercase tracking-widest mb-3">Mission Control</h4>
                                                <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                                                    <p className="text-base text-foreground leading-relaxed">
                                                        {caseItem.missionControl}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Artifacts Gerados */}
                                            <div>
                                                <h4 className="text-sm font-bold text-primary uppercase tracking-widest mb-3">Artifacts Gerados</h4>
                                                <ul className="space-y-3">
                                                    {caseItem.artifacts.map((artifact, i) => (
                                                        <li key={i} className="flex items-start text-muted-foreground text-sm">
                                                            <div className="h-2 w-2 rounded-full bg-primary mt-1.5 mr-3 shrink-0" />
                                                            {artifact}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Resultados */}
                                            <div className="pt-6 border-t border-border/50">
                                                <h4 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4">Resultados Mensuráveis</h4>
                                                <div className="space-y-4">
                                                    {caseItem.resultados.map((resultado, i) => (
                                                        <div key={i} className="flex items-center text-lg font-bold text-foreground">
                                                            <ArrowUpRight className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                                                            {resultado}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="pt-8">
                                                <Link href="/contato" className="inline-flex items-center text-sm font-semibold text-primary cursor-pointer hover:text-accent group/link">
                                                    Discutir arquitetura similar
                                                    <ArrowUpRight className="ml-1 h-4 w-4 transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
                                                </Link>
                                            </div>
                                        </div>

                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="mt-20 text-center p-12 glass-panel rounded-2xl border border-primary/20 bg-primary/5 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent"></div>
                            <h3 className="text-2xl font-bold mb-4">Seu problema operacional é o nosso próximo caso de sucesso.</h3>
                            <p className="text-muted-foreground mb-8 text-lg max-w-xl mx-auto">
                                Nossos parceiros começaram agendando um diagnóstico técnico de arquitetura. O
                                mapa para a sua infraestrutura pode ser traçado na nossa primeira call.
                            </p>
                            <Link href="/contato" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
                                Agendar Diagnóstico
                            </Link>
                        </div>
                    </div>
                </section>
            </FadeIn>
        </div>
    );
}
