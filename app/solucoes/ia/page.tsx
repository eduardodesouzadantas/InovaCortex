import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bot } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";
import { FadeIn } from "@/components/fade-in";

export const metadata: Metadata = {
    title: "Agentes de IA | InovaCortex",
    description: "Conheça nossa arquitetura de Agentes Especializados de IA.",
};

export default function AgentesIAPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <FadeIn delay={0}>
                <section className="relative pt-32 pb-32 border-b border-border/40 overflow-hidden bg-muted/10 flex-1 flex flex-col justify-center items-center h-[80vh]">
                    <div className="absolute inset-0 z-0 bg-primary/5" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full opacity-50 pointer-events-none" />

                    <div className="container mx-auto px-4 relative z-10 text-center flex flex-col items-center">
                        <div className="mb-8 p-4 rounded-xl bg-primary/10 inline-flex">
                            <Bot className="h-10 w-10 text-primary" />
                        </div>
                        <Badge variant="outline" className="mb-6 font-normal border-primary/30 bg-primary/5 text-primary">
                            Infraestrutura Operacional Autônoma
                        </Badge>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-8">
                            Agentes de Inteligência <span className="text-gradient">Especializados</span>
                        </h1>

                        <div className="max-w-3xl mx-auto space-y-6 text-left">
                            <p className="text-xl text-muted-foreground leading-relaxed text-center mb-12">
                                Nós não construímos simples chatbots. Coordenamos entidades em rede que resolvem operações complexas e imprevisíveis sem supervisão humana constante.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mt-12 bg-background/50 p-8 rounded-2xl border border-border/50 backdrop-blur-sm">
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                        Raciocínio Adaptativo
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Diferente de fluxos tradicionais (if-else), nossos agentes utilizam LLMs de ponta para entender contexto de negócios, tomar decisões com base em manuais internos e agir de forma independente para resolver o problema estrutural do cliente.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                        Integração Ativa
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Agentes InovaCortex não apenas respondem perguntas, eles executam tarefas. Eles abrem chamados no Jira, consultam estoque no SAP, alteram status no Salesforce e enviam faturas via Stripe, fechando o ciclo da operação.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                        Múltiplos Especialistas
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Arquitetamos redes multi-agente. Você pode ter um Agente de Triagem recebendo o cliente, que transfere o contexto para um Agente de Reembolso, que por sua vez aciona o Agente Financeiro. Escala instantânea.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                        Controle e Governança
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Toda ação do agente gera um "Artefato". Um registro imutável do raciocínio da máquina. O Mission Control permite que gestores vejam exatamente porque a IA tomou determinada decisão, com auditoria corporativa.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 flex gap-4">
                            <Link href="/contato" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
                                Agendar Diagnóstico
                            </Link>
                            <Link href="/" className="inline-flex h-12 items-center justify-center rounded-md border border-border/50 bg-background/50 backdrop-blur-sm px-8 text-sm font-medium hover:bg-muted transition-colors">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar
                            </Link>
                        </div>
                    </div>
                </section>
            </FadeIn>
        </div>
    );
}
