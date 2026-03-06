import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";
import { FadeIn } from "@/components/fade-in";

export const metadata: Metadata = {
    title: "Automação Integrada | InovaCortex",
    description: "Substituímos o software estático por workflows que orquestram toda sua operação.",
};

export default function AutomacaoPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <FadeIn delay={0}>
                <section className="relative pt-32 pb-32 border-b border-border/40 overflow-hidden bg-muted/10 flex-1 flex flex-col justify-center items-center h-[80vh]">
                    <div className="absolute inset-0 z-0 bg-primary/5" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full opacity-50 pointer-events-none" />

                    <div className="container mx-auto px-4 relative z-10 text-center flex flex-col items-center">
                        <div className="mb-8 p-4 rounded-xl bg-primary/10 inline-flex">
                            <Zap className="h-10 w-10 text-accent" />
                        </div>
                        <Badge variant="outline" className="mb-6 font-normal border-primary/30 bg-primary/5 text-primary">
                            Automação Operacional Extrema
                        </Badge>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-8">
                            Workflows que <span className="text-gradient">Pensam</span>
                        </h1>

                        <div className="max-w-3xl mx-auto space-y-6 text-left">
                            <p className="text-xl text-muted-foreground leading-relaxed text-center mb-12">
                                Automatizar não é apenas ligar o Sistema A ao Sistema B. É orquestrar processos caóticos e transformar trabalho repetitivo em velocidade assíncrona 24/7.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mt-12 bg-background/50 p-8 rounded-2xl border border-border/50 backdrop-blur-sm">
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-accent" />
                                        Workflows Adaptáveis
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Automações tradicionais quebram sob exceções. Nossos fluxos incorporam modelos de IA para lidar de dados não-estruturados, garantindo que o processo continue mesmo quando a entrada varia.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-accent" />
                                        Integração Legada (Deep Integration)
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Conectamos tudo. De ERPs robustos (SAP, Oracle) até CRMs nativos da web (Salesforce, Hubspot), passando por APIs internas customizadas e bancos de dados obscuros.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-accent" />
                                        Processamento de Documentos
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Pipelines que leem e extraem dados de milhares de faturas, contratos em PDF, imagens e e-mails despadronizados. A IA extrai e a Automação insere no seu ERP.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-accent" />
                                        Escala Assíncrona
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Execução baseada em eventos (Event-driven). Seu sistema de automação aguarda passivamente e, quando acionado, pode instanciar milhares de processos paralelos (Serverless Workers).
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 flex gap-4">
                            <Link href="/contato" className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-8 text-sm font-medium text-accent-foreground shadow transition-colors hover:bg-accent/90">
                                Automatizar Processo
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
