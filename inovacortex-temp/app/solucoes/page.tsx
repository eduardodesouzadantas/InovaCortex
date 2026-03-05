import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Code2, Cpu, LineChart, FileText, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";
import { FadeIn } from "@/components/fade-in";

export const metadata: Metadata = {
    title: "Soluções | InovaCortex",
    description: "Conheça nossas soluções em Agentes de IA, Automação de Processos, Desenvolvimento SaaS e Dashboards Inteligentes.",
};

export default function SolucoesPage() {
    const features = [
        {
            id: "agentes",
            slug: "/solucoes/ia",
            title: "Agentes de Inteligência Artificial",
            description: "Assistentes conversacionais autônomos que entendem o contexto do seu negócio, geram respostas humanizadas e executam ações complexas em tempo real. Muito além de um simples chatbot de regras.",
            icon: <Bot className="h-10 w-10 text-primary" />,
            capabilities: [
                "Atendimento ao cliente 24/7 omni-channel (WhatsApp, Site, Instagram)",
                "Qualificação contínua de leads e agendamento de reuniões",
                "Suporte técnico escalável integrado à sua base de conhecimento interna",
                "Análise de sentimentos e triagem inteligente para operadores humanos"
            ]
        },
        {
            id: "automacao",
            slug: "/solucoes/automacao",
            title: "Automação de Processos (RPA)",
            description: "Robôs de software programados para assumir as tarefas repetitivas e manuais da sua equipe. Integramos sistemas que não conversam entre si e orquestramos fluxos de dados sem falhas.",
            icon: <Cpu className="h-10 w-10 text-accent" />,
            capabilities: [
                "Extração e processamento de dados fiscais e documentos (OCR)",
                "Onboarding automatizado de clientes e funcionários",
                "Conciliação financeira multi-bancos sem intervenção humana",
                "Integrações via API customizadas entre CRMs, ERPs (Salesforce, SAP, RD Station)"
            ]
        },
        {
            id: "saas",
            slug: "/solucoes/saas",
            title: "SaaS Premium Corporativo",
            description: "Criamos plataformas web modernas, responsivas e construídas para suportar milhões de requisições. Desenvolvimento de alto nível utilizando Next.js, Node e arquiteturas serverless/cloud-native.",
            icon: <Code2 className="h-10 w-10 text-primary" />,
            capabilities: [
                "Portais de clientes e Painéis Administrativos sob medida",
                "Arquitetura Multi-Tenant segura (Security by Design)",
                "Aplicações nativas prontas para integração de modelos de IA",
                "Performance e métricas Core Web Vitals auditadas"
            ]
        },
        {
            id: "dashboards",
            slug: "/solucoes/dashboards",
            title: "Dashboards Inteligentes",
            description: "Transformamos centenas de planilhas e bancos de dados fragmentados em uma única central de comando visual. Identifique gargalos e oportunidades com um olhar.",
            icon: <LineChart className="h-10 w-10 text-accent" />,
            capabilities: [
                "Visualização de dados dinâmicos em tempo real",
                "Geração de relatórios executivos automatizados em PDF/Excel",
                "Previsões (Forecasting) utilizando algoritmos de Machine Learning",
                "Controle granular de acesso por nível hierárquico (RBAC)"
            ]
        }
    ];

    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section Local */}
            <FadeIn delay={0}>
                <section className="relative pt-32 pb-20 border-b border-border/40 overflow-hidden">
                    <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
                    <div className="container mx-auto px-4 md:px-8 max-w-screen-xl relative z-10 text-center">
                        <Badge variant="outline" className="mb-6 font-normal border-primary/30 bg-primary/5 text-primary">
                            Nossas Soluções
                        </Badge>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
                            O Ecossistema <span className="text-gradient">Agent-First</span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                            Não vendemos software de prateleira. Construímos a infraestrutura avançada
                            que permitirá ao seu negócio escalar infinitamente com esforço marginal próximo a zero.
                        </p>
                    </div>
                </section>
            </FadeIn>

            {/* Solutions Detailed */}
            <FadeIn delay={150}>
                <section className="py-24 bg-muted/20">
                    <div className="container mx-auto px-4 md:px-8 max-w-screen-xl">
                        <div className="space-y-32">
                            {features.map((feature, idx) => (
                                <div key={feature.id} id={feature.id} className={`flex flex-col gap-12 lg:gap-20 items-center ${idx % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>

                                    {/* Visual / Icon Box */}
                                    <div className="w-full lg:w-5/12">
                                        <div className="aspect-square rounded-3xl bg-gradient-to-br from-background to-muted border border-border/50 shadow-2xl flex items-center justify-center relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                            <div className="absolute w-[200%] h-[200%] bg-gradient-to-br from-primary/10 via-transparent to-transparent -translate-x-1/2 -translate-y-1/2 rounded-full animate-[spin_10s_linear_infinite] opacity-50"></div>
                                            <div className="relative z-10 p-10 bg-background/80 backdrop-blur-xl rounded-2xl border border-border/50 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                                {feature.icon}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="w-full lg:w-7/12 space-y-6">
                                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground mb-2">
                                            {feature.icon}
                                        </div>
                                        <h2 className="text-3xl font-bold tracking-tight">{feature.title}</h2>
                                        <p className="text-lg text-muted-foreground leading-relaxed">
                                            {feature.description}
                                        </p>

                                        <div className="pt-6">
                                            <h4 className="font-semibold text-foreground mb-4 flex items-center">
                                                <FileText className="h-4 w-4 mr-2 text-primary" /> Recursos Principais
                                            </h4>
                                            <ul className="grid gap-3 sm:grid-cols-2">
                                                {feature.capabilities.map((cap, i) => (
                                                    <li key={i} className="flex items-start">
                                                        <CheckCircle2 className="h-5 w-5 text-primary mr-2 shrink-0 mt-0.5" />
                                                        <span className="text-muted-foreground text-sm leading-relaxed">{cap}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="pt-8 flex flex-wrap gap-4">
                                            <Button className="font-semibold" asChild>
                                                <Link href={feature.slug}>Ver Arquitetura <ArrowRight className="ml-2 h-4 w-4" /></Link>
                                            </Button>
                                            <Button variant="outline" className="glass-panel" asChild>
                                                <Link href="/contato">Agendar Demonstração</Link>
                                            </Button>
                                        </div>
                                    </div>

                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </FadeIn>

            {/* CTA Local */}
            <FadeIn delay={150}>
                <section className="py-24 relative overflow-hidden bg-background">
                    <div className="container mx-auto px-4 md:px-8 max-w-screen-xl relative z-10 text-center">
                        <h2 className="text-3xl font-bold mb-6">Ainda tem dúvidas sobre o impacto técnico?</h2>
                        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                            Nossa arquitetura prioriza "Security by Design". Agende uma call com nossos engenheiros
                            e entenda como protegemos seus dados enquanto a IA atua.
                        </p>
                        <Button size="lg" asChild>
                            <Link href="/contato">Falar com a Engenharia <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        </Button>
                    </div>
                </section>
            </FadeIn>
        </div>
    );
}
